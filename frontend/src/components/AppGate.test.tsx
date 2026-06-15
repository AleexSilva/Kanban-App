import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppGate } from "@/components/AppGate";

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppGate", () => {
  it("shows the login form when unauthenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, { detail: "Not authenticated" }))
    );

    render(<AppGate />);

    expect(
      await screen.findByRole("heading", { name: "Sign in" })
    ).toBeInTheDocument();
  });

  it("shows the board after a successful login", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/me")) {
        return jsonResponse(401, { detail: "Not authenticated" });
      }
      if (url.endsWith("/api/login")) {
        return jsonResponse(200, { username: "user" });
      }
      if (url.endsWith("/api/board")) {
        return jsonResponse(200, { columns: [], cards: {} });
      }
      return jsonResponse(404, {});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppGate />);

    const form = await screen.findByRole("heading", { name: "Sign in" });
    expect(form).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
  });

  it("shows an error on invalid credentials", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/login")) {
        return jsonResponse(401, { detail: "Invalid credentials" });
      }
      return jsonResponse(401, { detail: "Not authenticated" });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppGate />);

    await screen.findByRole("heading", { name: "Sign in" });
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid username or password/i
    );
  });

  it("returns to login after logout", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/me")) {
        return jsonResponse(200, { username: "user" });
      }
      if (url.endsWith("/api/logout")) {
        return jsonResponse(200, { status: "ok" });
      }
      if (url.endsWith("/api/board")) {
        return jsonResponse(200, { columns: [], cards: {} });
      }
      return jsonResponse(404, {});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppGate />);

    await screen.findByRole("heading", { name: "Kanban Studio" });
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Sign in" })
      ).toBeInTheDocument();
    });
  });
});
