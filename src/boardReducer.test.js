import { describe, expect, it } from "vitest";
import { boardReducer, filterCards, initialState } from "./boardReducer";

describe("boardReducer", () => {
  it("adds a card to the end of a column", () => {
    const s = boardReducer(initialState, { type: "ADD_CARD", id: "x", columnId: "review", title: " Test " });
    expect(s.columns.review).toEqual(["x"]);
    expect(s.cards.x.title).toBe("Test");
  });

  it("ignores empty titles", () => {
    expect(boardReducer(initialState, { type: "ADD_CARD", columnId: "todo", title: "  " })).toBe(initialState);
  });

  it("moves a card across columns at a given index", () => {
    const s = boardReducer(initialState, { type: "MOVE_CARD", id: "c1", toColumn: "todo", toIndex: 1 });
    expect(s.columns.progress).toEqual([]);
    expect(s.columns.todo).toEqual(["c2", "c1", "c3"]);
  });

  it("reorders within the same column", () => {
    const s = boardReducer(initialState, { type: "MOVE_CARD", id: "c2", toColumn: "todo", toIndex: 1 });
    expect(s.columns.todo).toEqual(["c3", "c2"]);
  });

  it("deletes a card from cards and columns", () => {
    const s = boardReducer(initialState, { type: "DELETE_CARD", id: "c4" });
    expect(s.cards.c4).toBeUndefined();
    expect(s.columns.done).toEqual([]);
  });

  it("filters by query and priority", () => {
    expect(filterCards(initialState, { query: "front" }).todo).toEqual(["c3"]);
    expect(filterCards(initialState, { priority: "high" }).progress).toEqual(["c1"]);
    expect(filterCards(initialState, { priority: "high" }).todo).toEqual([]);
  });
});
