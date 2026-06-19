from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    with TestClient(app) as c:
        yield c


def login(client: TestClient) -> None:
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_chat_requires_authentication(client):
    response = client.post("/api/chat", json={"message": "Hello", "history": []})
    assert response.status_code == 401


def test_chat_reply_only(client):
    login(client)
    with patch("app.main.chat_with_board", return_value={"reply": "Sure!", "board": None}):
        response = client.post("/api/chat", json={"message": "Hello", "history": []})
    assert response.status_code == 200
    assert response.json() == {"reply": "Sure!", "board_updated": False}


def test_chat_with_board_update(client):
    login(client)
    updated_board = {
        "columns": [{"id": "col-1", "title": "To Do", "cardIds": ["card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "Test Task", "details": ""}},
    }
    with patch("app.main.chat_with_board", return_value={"reply": "Done!", "board": updated_board}):
        response = client.post("/api/chat", json={"message": "Add a card", "history": []})
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Done!"
    assert data["board_updated"] is True
    # Verify the board was actually persisted
    board = client.get("/api/board").json()
    assert board["columns"][0]["title"] == "To Do"
    assert "card-1" in board["cards"]


def test_chat_returns_502_on_malformed_ai_response(client):
    login(client)
    with patch("app.main.chat_with_board", side_effect=ValueError("AI returned non-JSON response")):
        response = client.post("/api/chat", json={"message": "hi", "history": []})
    assert response.status_code == 502


def test_chat_rejects_malformed_board(client):
    login(client)
    original = client.get("/api/board").json()
    with patch("app.main.chat_with_board", return_value={"reply": "Here!", "board": {"invalid": "data"}}):
        response = client.post("/api/chat", json={"message": "Do something", "history": []})
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Here!"
    assert data["board_updated"] is False
    # Original board must be unchanged
    assert client.get("/api/board").json() == original
