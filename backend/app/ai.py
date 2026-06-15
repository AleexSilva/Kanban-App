import os

import httpx
from openai import OpenAI

MODEL = "openai/gpt-oss-120b"
BASE_URL = "https://openrouter.ai/api/v1"


def ask(messages: list[dict]) -> str:
    # verify=False works around the local proxy's self-signed certificate
    # (same issue as the ghcr.io workaround in the Dockerfile).
    client = OpenAI(
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url=BASE_URL,
        http_client=httpx.Client(verify=False),
    )
    response = client.chat.completions.create(model=MODEL, messages=messages)
    return response.choices[0].message.content
