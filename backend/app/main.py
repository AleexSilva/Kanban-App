import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from starlette.middleware.sessions import SessionMiddleware

from app.ai import chat_with_board
from app.db import get_board, get_connection, get_or_create_user, init_db, save_board
from app.models import BoardData


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="PM MVP", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET", "dev-secret-change-me"),
)

# Hardcoded MVP credentials (see AGENTS.md).
USERNAME = "user"
PASSWORD = "password"


class Credentials(BaseModel):
    username: str
    password: str


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    if credentials.username != USERNAME or credentials.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(request: Request):
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"username": username}


def require_user(request: Request) -> str:
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return username


def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


@app.get("/api/board")
def read_board(username: str = Depends(require_user), conn=Depends(get_db)):
    user_id = get_or_create_user(conn, username)
    return get_board(conn, user_id)


@app.put("/api/board")
def replace_board(
    board: BoardData,
    username: str = Depends(require_user),
    conn=Depends(get_db),
):
    user_id = get_or_create_user(conn, username)
    save_board(conn, user_id, board.model_dump())
    return board


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


@app.post("/api/chat")
def chat(body: ChatRequest, username: str = Depends(require_user), conn=Depends(get_db)):
    user_id = get_or_create_user(conn, username)
    board = get_board(conn, user_id)
    messages = [m.model_dump() for m in body.history] + [{"role": "user", "content": body.message}]
    try:
        result = chat_with_board(messages, board)
    except ValueError:
        raise HTTPException(status_code=502, detail="AI returned an unparseable response")

    board_updated = False
    if result.get("board"):
        try:
            validated = BoardData.model_validate(result["board"])
            save_board(conn, user_id, validated.model_dump())
            board_updated = True
        except ValidationError:
            pass

    return {"reply": result.get("reply", ""), "board_updated": board_updated}


# Directory of static files served at /. Defaults to the placeholder page; in the
# container STATIC_DIR points at the built frontend export (see backend/Dockerfile).
static_dir = Path(os.environ.get("STATIC_DIR", Path(__file__).parent / "static"))
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
