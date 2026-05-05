import { useEffect, useReducer, useState } from "react";
import { boardReducer, COLUMNS, filterCards, initialState } from "./boardReducer";
import Column from "./components/Column";

const STORAGE_KEY = "kanban-board-v1";

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialState;
  } catch {
    return initialState;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(boardReducer, undefined, loadState);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable: the board still works in memory */
    }
  }, [state]);

  const visibleColumns = filterCards(state, { query, priority });
  const isFiltering = query.trim() !== "" || priority !== "all";
  const total = Object.keys(state.cards).length;
  const done = state.columns.done.length;

  return (
    <div className="app">
      <header>
        <div>
          <h1>Kanban Board</h1>
          <p className="progress">
            {done} of {total} done
            <span className="bar"><span style={{ width: total ? `${(done / total) * 100}%` : 0 }} /></span>
          </p>
        </div>
        <div className="filters">
          <input placeholder="Search title or tag..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button className="ghost" onClick={() => confirm("Reset the board?") && dispatch({ type: "RESET" })}>
            Reset
          </button>
        </div>
      </header>

      {isFiltering && <p className="hint">Filtering is on. Drag and drop still works on the visible cards.</p>}

      <main className="board">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            column={col}
            cardIds={visibleColumns[col.id]}
            allCardIds={state.columns[col.id]}
            cards={state.cards}
            dispatch={dispatch}
            dragging={dragging}
            setDragging={setDragging}
          />
        ))}
      </main>
    </div>
  );
}
