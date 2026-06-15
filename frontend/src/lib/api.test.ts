import { afterEach, describe, expect, it, vi } from "vitest";
import { getBoard, saveBoard } from "@/lib/api";

const emptyBoard = { columns: [], cards: {} };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api", () => {
  it("getBoard returns the parsed board", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => emptyBoard }))
    );
    expect(await getBoard()).toEqual(emptyBoard);
  });

  it("getBoard throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 })));
    await expect(getBoard()).rejects.toThrow();
  });

  it("saveBoard PUTs the board as JSON", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await saveBoard(emptyBoard);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(emptyBoard),
      })
    );
  });

  it("saveBoard throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(saveBoard(emptyBoard)).rejects.toThrow();
  });
});
