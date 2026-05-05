// Pure reducer for board state. Kept free of React so it can be unit-tested directly.

export const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

export const initialState = {
  cards: {
    c1: { id: "c1", title: "Set up project repo", priority: "high", tags: ["setup"] },
    c2: { id: "c2", title: "Design database schema", priority: "medium", tags: ["backend"] },
    c3: { id: "c3", title: "Build login page", priority: "medium", tags: ["frontend"] },
    c4: { id: "c4", title: "Write README", priority: "low", tags: ["docs"] },
  },
  columns: { todo: ["c2", "c3"], progress: ["c1"], review: [], done: ["c4"] },
};

let counter = Date.now();
const newId = () => `c${(counter++).toString(36)}`;

export function boardReducer(state, action) {
  switch (action.type) {
    case "ADD_CARD": {
      const id = action.id ?? newId();
      const card = { id, title: action.title.trim(), priority: action.priority || "medium", tags: action.tags || [] };
      if (!card.title) return state;
      return {
        cards: { ...state.cards, [id]: card },
        columns: { ...state.columns, [action.columnId]: [...state.columns[action.columnId], id] },
      };
    }

    case "UPDATE_CARD": {
      if (!state.cards[action.id]) return state;
      return { ...state, cards: { ...state.cards, [action.id]: { ...state.cards[action.id], ...action.changes } } };
    }

    case "DELETE_CARD": {
      const { [action.id]: _removed, ...cards } = state.cards;
      const columns = Object.fromEntries(
        Object.entries(state.columns).map(([col, ids]) => [col, ids.filter((x) => x !== action.id)])
      );
      return { cards, columns };
    }

    case "MOVE_CARD": {
      // Move a card to `toColumn` at `toIndex` (end of column if omitted).
      const { id, toColumn } = action;
      const fromColumn = Object.keys(state.columns).find((c) => state.columns[c].includes(id));
      if (!fromColumn || !state.columns[toColumn]) return state;

      const columns = { ...state.columns, [fromColumn]: state.columns[fromColumn].filter((x) => x !== id) };
      const target = [...columns[toColumn]];
      const index = action.toIndex == null ? target.length : Math.max(0, Math.min(action.toIndex, target.length));
      target.splice(index, 0, id);
      columns[toColumn] = target;
      return { ...state, columns };
    }

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function filterCards(state, { query = "", priority = "all" }) {
  const q = query.trim().toLowerCase();
  const visible = (card) =>
    (priority === "all" || card.priority === priority) &&
    (!q || card.title.toLowerCase().includes(q) || card.tags.some((t) => t.toLowerCase().includes(q)));
  return Object.fromEntries(
    Object.entries(state.columns).map(([col, ids]) => [col, ids.filter((id) => visible(state.cards[id]))])
  );
}
