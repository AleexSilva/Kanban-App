import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    return TestClient(app)


def login(client: TestClient) -> None:
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_board_requires_authentication(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json={"columns": [], "cards": {}}).status_code == 401


def test_db_file_created_on_first_access(client, tmp_path):
    db_path = tmp_path / "test.db"
    assert not db_path.exists()
    login(client)
    client.get("/api/board")
    assert db_path.exists()


def test_get_board_returns_seeded_board_for_new_user(client):
    login(client)
    response = client.get("/api/board")
    assert response.status_code == 200
    board = response.json()
    assert len(board["columns"]) == 5
    assert len(board["cards"]) == 8
    assert board["columns"][0]["id"] == "col-backlog"


def test_put_board_persists_changes(client):
    login(client)
    new_board = {
        "columns": [{"id": "col-a", "title": "A", "cardIds": ["card-x"]}],
        "cards": {"card-x": {"id": "card-x", "title": "X", "details": "details"}},
    }
    put_response = client.put("/api/board", json=new_board)
    assert put_response.status_code == 200

    get_response = client.get("/api/board")
    assert get_response.json() == new_board


def test_put_board_rejects_malformed_payload(client):
    login(client)
    # Missing required "details" on the card.
    bad_board = {
        "columns": [{"id": "col-a", "title": "A", "cardIds": ["card-x"]}],
        "cards": {"card-x": {"id": "card-x", "title": "X"}},
    }
    assert client.put("/api/board", json=bad_board).status_code == 422


def test_boards_are_scoped_per_user(client, monkeypatch):
    # User "user" saves a custom board.
    login(client)
    custom = {
        "columns": [{"id": "col-a", "title": "A", "cardIds": []}],
        "cards": {},
    }
    client.put("/api/board", json=custom)

    # A different username gets its own freshly seeded board, not "user"'s.
    monkeypatch.setattr("app.main.USERNAME", "other")
    monkeypatch.setattr("app.main.PASSWORD", "pw")
    other = TestClient(app)
    other.post("/api/login", json={"username": "other", "password": "pw"})
    other_board = other.get("/api/board").json()
    assert len(other_board["columns"]) == 5
