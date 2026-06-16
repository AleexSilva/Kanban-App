import json
import os

import httpx
from openai import OpenAI

# Models are tried in order; if one is unavailable, the next is used. Override
# with the OPENROUTER_MODELS env var (comma-separated). The primary stays
# openai/gpt-oss-120b per the project spec.
DEFAULT_MODELS = [
    "meta-llama/llama-3.3-70b-instruct",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
]
BASE_URL = "https://openrouter.ai/api/v1"


def _models() -> list[str]:
    raw = os.environ.get("OPENROUTER_MODELS")
    if raw:
        return [model.strip() for model in raw.split(",") if model.strip()]
    return DEFAULT_MODELS

_BOARD_SCHEMA = """\
{
  "columns": [{"id": "<string>", "title": "<string>", "cardIds": ["<card-id>", ...]}],
  "cards": {"<card-id>": {"id": "<string>", "title": "<string>", "details": "<string>"}}
}"""

SYSTEM_PROMPT = f"""\
You are a Kanban board assistant. Respond ONLY with valid JSON in this exact format:
{{"reply": "<message to user>", "board": <updated board JSON or null>}}

Include "board" when the user asks to add, move, edit, or delete cards or rename columns.
Use unique IDs like "card-<short-uuid>" for new cards.
Set "board" to null when no board changes are needed.

Board schema:
{_BOARD_SCHEMA}"""


def _client() -> OpenAI:
    # verify=False works around the local proxy's self-signed certificate.
    return OpenAI(
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url=BASE_URL,
        http_client=httpx.Client(verify=False),
    )


def _complete(**kwargs):
    """Call the chat completions API, falling back through _models() in order."""
    client = _client()
    last_error: Exception | None = None
    for model in _models():
        try:
            return client.chat.completions.create(model=model, **kwargs)
        except Exception as error:  # model unavailable / errored: try the next
            last_error = error
    raise RuntimeError(f"All models failed; last error: {last_error}") from last_error


def ask(messages: list[dict]) -> str:
    response = _complete(messages=messages)
    return response.choices[0].message.content


def chat_with_board(messages: list[dict], board: dict) -> dict:
    """Returns {"reply": str, "board": dict | None}."""
    system = f"{SYSTEM_PROMPT}\n\nCurrent board:\n{json.dumps(board, indent=2)}"
    full_messages = [{"role": "system", "content": system}] + messages
    response = _complete(
        messages=full_messages,
        response_format={"type": "json_object"},
    )
    try:
        return json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"AI returned non-JSON response: {exc}") from exc
