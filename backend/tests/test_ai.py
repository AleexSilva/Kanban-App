import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENROUTER_API_KEY"),
    reason="OPENROUTER_API_KEY not set",
)


def test_2_plus_2():
    from app.ai import ask

    reply = ask([{"role": "user", "content": "What is 2+2? Reply with just the number."}])
    assert "4" in reply
