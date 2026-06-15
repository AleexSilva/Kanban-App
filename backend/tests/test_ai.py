import os

import pytest

from app import ai


class _FakeResponse:
    def __init__(self, content):
        message = type("M", (), {"content": content})()
        choice = type("C", (), {"message": message})()
        self.choices = [choice]


def _fake_client(behavior):
    """behavior: model -> content string, or raises if the value is an Exception."""
    calls = []

    class _Completions:
        def create(self, model, **kwargs):
            calls.append(model)
            result = behavior[model]
            if isinstance(result, Exception):
                raise result
            return _FakeResponse(result)

    client = type(
        "Client", (), {"chat": type("Chat", (), {"completions": _Completions()})()}
    )()
    return client, calls


def test_uses_first_model_when_available(monkeypatch):
    monkeypatch.setenv("OPENROUTER_MODELS", "model-a,model-b")
    client, calls = _fake_client({"model-a": "4", "model-b": "should-not-be-used"})
    monkeypatch.setattr(ai, "_client", lambda: client)

    assert ai.ask([{"role": "user", "content": "2+2?"}]) == "4"
    assert calls == ["model-a"]


def test_falls_back_when_first_model_unavailable(monkeypatch):
    monkeypatch.setenv("OPENROUTER_MODELS", "model-a,model-b")
    client, calls = _fake_client(
        {"model-a": RuntimeError("model unavailable"), "model-b": "4"}
    )
    monkeypatch.setattr(ai, "_client", lambda: client)

    assert ai.ask([{"role": "user", "content": "2+2?"}]) == "4"
    assert calls == ["model-a", "model-b"]


def test_raises_when_all_models_fail(monkeypatch):
    monkeypatch.setenv("OPENROUTER_MODELS", "model-a,model-b")
    client, calls = _fake_client(
        {"model-a": RuntimeError("down"), "model-b": RuntimeError("down")}
    )
    monkeypatch.setattr(ai, "_client", lambda: client)

    with pytest.raises(RuntimeError):
        ai.ask([{"role": "user", "content": "2+2?"}])
    assert calls == ["model-a", "model-b"]


@pytest.mark.skipif(
    not os.getenv("OPENROUTER_API_KEY"),
    reason="OPENROUTER_API_KEY not set",
)
def test_2_plus_2():
    reply = ai.ask(
        [{"role": "user", "content": "What is 2+2? Reply with just the number."}]
    )
    assert "4" in reply
