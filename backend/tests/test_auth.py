from fastapi.testclient import TestClient

from app.main import app


def test_login_succeeds_with_valid_credentials():
    client = TestClient(app)
    response = client.post(
        "/api/login", json={"username": "user", "password": "password"}
    )
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_login_fails_with_invalid_credentials():
    client = TestClient(app)
    response = client.post(
        "/api/login", json={"username": "user", "password": "wrong"}
    )
    assert response.status_code == 401


def test_me_requires_authentication():
    client = TestClient(app)
    response = client.get("/api/me")
    assert response.status_code == 401


def test_me_returns_user_after_login():
    client = TestClient(app)
    client.post("/api/login", json={"username": "user", "password": "password"})
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json()["username"] == "user"


def test_logout_clears_session():
    client = TestClient(app)
    client.post("/api/login", json={"username": "user", "password": "password"})
    client.post("/api/logout")
    response = client.get("/api/me")
    assert response.status_code == 401
