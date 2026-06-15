import json
import os

import httpx
from openai import OpenAI

MODEL = "openai/gpt-oss-120b"
BASE_URL = "https://openrouter.ai/api/v1"

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


def ask(messages: list[dict]) -> str:
    response = _client().chat.completions.create(model=MODEL, messages=messages)
    return response.choices[0].message.content


def chat_with_board(messages: list[dict], board: dict) -> dict:
    """Returns {"reply": str, "board": dict | None}."""
    system = f"{SYSTEM_PROMPT}\n\nCurrent board:\n{json.dumps(board, indent=2)}"
    full_messages = [{"role": "system", "content": system}] + messages
    response = _client().chat.completions.create(
        model=MODEL,
        messages=full_messages,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)
