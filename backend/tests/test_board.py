import pytest
from fastapi.testclient import TestClient

from app.db import get_board, get_connection, get_or_create_user
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    with TestClient(app) as c:
        yield c


def login(client: TestClient) -> None:
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_board_requires_authentication(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json={"columns": [], "cards": {}}).status_code == 401


def test_db_file_created_on_startup(client, tmp_path):
    # init_db() now runs during app lifespan startup, so the file exists
    # before any request is made.
    db_path = tmp_path / "test.db"
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


def test_boards_are_scoped_per_user(client):
    # User "user" saves a custom board via the API.
    login(client)
    custom = {
        "columns": [{"id": "col-a", "title": "A", "cardIds": []}],
        "cards": {},
    }
    client.put("/api/board", json=custom)

    # Verify isolation at the DB layer: a different user gets their own seeded
    # board, not "user"'s custom one. Going through the DB layer avoids patching
    # hardcoded credentials just to exercise data isolation.
    conn = get_connection()
    try:
        other_id = get_or_create_user(conn, "other")
        other_board = get_board(conn, other_id)
        conn.commit()
    finally:
        conn.close()

    assert len(other_board["columns"]) == 5
    assert len(other_board["cards"]) == 8


def test_get_or_create_user_is_idempotent(client):
    # Calling get_or_create_user twice for the same username must return the
    # same id and not raise an IntegrityError (INSERT OR IGNORE is atomic).
    conn = get_connection()
    try:
        id1 = get_or_create_user(conn, "alice")
        id2 = get_or_create_user(conn, "alice")
        conn.commit()
    finally:
        conn.close()

    assert id1 == id2
