# Code Review

Reviewed 2026-06-16. All 54 tests pass at the time of review. Findings are ordered by severity within each section.

---

## Bugs

### 1. `chat_with_board()` JSON parse failure raises an unhandled 500

`backend/app/ai.py` line ~58:
```python
return json.loads(response.choices[0].message.content)
```
If the model returns non-JSON (or malformed JSON despite `response_format={"type": "json_object"}`), this raises and propagates as an unhandled 500. The caller in `main.py` only catches exceptions _after_ this call succeeds. Wrap the `json.loads` in a try/except and either raise a descriptive `HTTPException(502)` or return `{"reply": "Sorry, I couldn't understand the AI response.", "board": None}`.

### 2. `except Exception: pass` swallows all errors, not just validation failures

`backend/app/main.py` `/api/chat` handler:
```python
try:
    validated = BoardData.model_validate(result["board"])
    save_board(conn, user_id, validated.model_dump())
    board_updated = True
except Exception:
    pass
```
This silently eats database errors, disk-full errors, and any other exception that is not a Pydantic validation failure. The response becomes `{"reply": "...", "board_updated": false}` with no indication that something went wrong. Catch `ValidationError` specifically; let other exceptions propagate.

```python
from pydantic import ValidationError
...
except ValidationError:
    pass
```

### 3. `init_db()` is called on every API request

`backend/app/main.py`:
```python
def get_db():
    init_db()          # opens + closes its own connection, runs CREATE TABLE IF NOT EXISTS
    conn = get_connection()
    ...
```
`init_db()` opens a separate SQLite connection, runs two DDL statements, commits, and closes — on every request. Move `init_db()` to a FastAPI `lifespan` startup hook so it runs once:

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="PM MVP", lifespan=lifespan)
```
Then remove the `init_db()` call from `get_db()`.

### 4. `KanbanCard` holds stale edit state after a board refresh

`frontend/src/components/KanbanCard.tsx`:
```ts
const [title, setTitle] = useState(card.title);
const [details, setDetails] = useState(card.details);
```
These are initialised from props once. If the AI updates the board while the user has this card open in edit mode, the form still shows the pre-refresh values. If the user then saves, the AI's changes are overwritten silently.

`startEditing()` already re-syncs from props:
```ts
const startEditing = () => {
  setTitle(card.title);
  setDetails(card.details);
  setIsEditing(true);
};
```
The fix is to also sync on prop changes while editing is open:
```ts
useEffect(() => {
  if (isEditing) {
    setTitle(card.title);
    setDetails(card.details);
  }
}, [card.title, card.details]);
```

---

## Security

### 5. `httpx.Client(verify=False)` disables TLS for all OpenRouter traffic

`backend/app/ai.py`:
```python
http_client=httpx.Client(verify=False)
```
This is documented as a local-proxy workaround. It means the app currently sends the API key and all board contents over a connection whose certificate is not verified. This is acceptable only for local development. Before this app is deployed anywhere else, replace with a trusted certificate or remove `verify=False` and resolve the proxy TLS issue at the network level. At minimum, guard it with an env flag:
```python
verify = os.environ.get("SSL_VERIFY", "true").lower() != "false"
http_client=httpx.Client(verify=verify)
```

### 6. Hardcoded fallback session secret is not guarded

`backend/app/main.py`:
```python
secret_key=os.environ.get("SESSION_SECRET", "dev-secret-change-me"),
```
If `SESSION_SECRET` is not set in production, all sessions are signed with a known string, making them forgeable. For an MVP that only runs locally this is fine, but the default should at minimum be a randomly generated value at startup, or raise at startup if unset. Add to `docker-compose.yml` under `environment:` so the container always sets it:
```yaml
SESSION_SECRET: ${SESSION_SECRET:?SESSION_SECRET must be set}
```

---

## Code Quality

### 7. `_client()` creates a new HTTP client on every AI call

`backend/app/ai.py`:
```python
def _client() -> OpenAI:
    return OpenAI(
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url=BASE_URL,
        http_client=httpx.Client(verify=False),
    )
```
A new `OpenAI` and `httpx.Client` (with its connection pool) is instantiated per request. Move to a module-level singleton:
```python
_openai_client: OpenAI | None = None

def _client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(
            api_key=os.environ["OPENROUTER_API_KEY"],
            base_url=BASE_URL,
            http_client=httpx.Client(verify=False),
        )
    return _openai_client
```

### 8. `ask()` is dead code in the production path

`backend/app/ai.py`: The `ask()` function is only referenced by one test (`test_2_plus_2`). Production code only uses `chat_with_board()`. Either remove `ask()` and rewrite the live test to call `chat_with_board()` with a minimal prompt, or leave it as a deliberate testing helper (and note that in a comment). As-is it is confusing.

### 9. `BoardData` model does not validate cross-references

`backend/app/models.py` and `frontend/src/lib/kanban.ts`: A `Column` can list a `cardId` that does not exist in `cards`, or a card can exist in `cards` without appearing in any column. Neither Pydantic nor TypeScript enforces this. An AI response with a dangling `cardId` will cause a runtime crash in the frontend when `board.cards[cardId]` returns `undefined` and is passed as `card` to `KanbanCard`. Add a Pydantic validator:

```python
from pydantic import model_validator

class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def card_refs_exist(self) -> "BoardData":
        for col in self.columns:
            for cid in col.cardIds:
                if cid not in self.cards:
                    raise ValueError(f"Column '{col.id}' references unknown card '{cid}'")
        return self
```

### 10. Inconsistent delete button label vs. aria-label

`frontend/src/components/KanbanCard.tsx`:
```tsx
<button aria-label={`Delete ${card.title}`}>
  Remove
</button>
```
Screen readers announce "Delete", sighted users read "Remove". One label should be used consistently. Either change the visible text to "Delete" or the aria-label to `Remove ${card.title}`. The e2e test uses `getByRole("button", { name: "Delete ..." })`, so if you change the aria-label, update `dnd-empty.spec.ts` accordingly.

### 11. `handleRenameCommit` reads state through a `setBoard` call

`frontend/src/components/KanbanBoard.tsx`:
```ts
const handleRenameCommit = () => {
  setBoard((prev) => {
    if (prev) persist(prev);
    return prev;
  });
};
```
Using a state setter just to read the current value is a side-effectful pattern. Use a ref to track the current board value alongside the state, or use a `boardRef` that always mirrors the current board:
```ts
const boardRef = useRef<BoardData | null>(null);
// In mutate and setBoard calls, keep boardRef.current in sync.

const handleRenameCommit = () => {
  if (boardRef.current) persist(boardRef.current);
};
```
Alternatively, simply add a `board` dependency to the callback (since the rename already updated local state synchronously, `board` is current at blur time):
```ts
const handleRenameCommit = useCallback(() => {
  if (board) persist(board);
}, [board]);
```

---

## Testing Gaps

### 12. AI JSON parse failure is not covered

Tests for `/api/chat` mock `chat_with_board` directly (which already returns a parsed dict), so the `json.loads` failure path in `ai.py` is never exercised. Add a unit test:
```python
def test_chat_with_board_raises_on_malformed_json(monkeypatch):
    monkeypatch.setattr(ai, "_complete", lambda **kw: _FakeResponse("not json"))
    with pytest.raises(Exception):
        ai.chat_with_board([{"role": "user", "content": "hi"}], {})
```

### 13. `get_or_create_user` TOCTOU is untested

`backend/app/db.py`: The SELECT-then-INSERT pattern in `get_or_create_user` is not atomic. A concurrent first request for the same new user could cause one INSERT to fail with a UNIQUE constraint violation. This is low-risk for the MVP (single hardcoded user, SQLite serialises writes), but the function lacks any handling for the `IntegrityError`. Add an `INSERT OR IGNORE` or `ON CONFLICT DO NOTHING` approach:
```python
conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))
return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()["id"]
```

### 14. No timeout on OpenRouter HTTP calls

`backend/app/ai.py`: The `httpx.Client` has no `timeout` set. If OpenRouter hangs, the `/api/chat` request hangs indefinitely, holding the uvicorn worker. Add a timeout:
```python
httpx.Client(verify=False, timeout=30.0)
```

### 15. `test_boards_are_scoped_per_user` patches module-level credentials

`backend/tests/test_board.py`:
```python
monkeypatch.setattr("app.main.USERNAME", "other")
monkeypatch.setattr("app.main.PASSWORD", "pw")
```
This works but is brittle: if `USERNAME`/`PASSWORD` are ever moved or renamed, the test silently passes without actually testing isolation. A less fragile approach is to directly call the login endpoint with a second client after inserting the second user via the DB layer, bypassing the credential check.

---

## Summary

| # | Area | Severity | Action |
|---|------|----------|--------|
| 1 | ai.py JSON parse | Bug | Wrap in try/except, return graceful error |
| 2 | /api/chat bare except | Bug | Catch `ValidationError` only |
| 3 | init_db per request | Bug/Perf | Move to lifespan startup hook |
| 4 | KanbanCard stale state | Bug | Sync state from props in useEffect |
| 5 | TLS verify=False | Security | Guard with env flag; document removal path |
| 6 | Fallback session secret | Security | Raise or randomise if SESSION_SECRET unset |
| 7 | _client() per call | Quality | Module-level singleton |
| 8 | ask() dead code | Quality | Remove or document as test helper |
| 9 | No cross-ref validation | Quality | Pydantic model_validator on BoardData |
| 10 | Delete vs Remove label | Quality | Unify accessible name and visible text |
| 11 | setBoard to read state | Quality | useCallback with board dep or boardRef |
| 12 | JSON parse not tested | Testing | Add unit test for malformed AI response |
| 13 | TOCTOU in get_or_create_user | Testing | Use INSERT OR IGNORE; add concurrent test |
| 14 | No HTTP timeout | Testing | Set timeout=30 on httpx.Client |
| 15 | Credential patching in test | Testing | Test isolation via DB layer instead |
