// Secondary, underline-style tab group — used to group related tools
// inside one workspace page (e.g. Portfolio: Holdings | Optimal Holdings |
// Cash Allocator | Bridge Trades) instead of giving each its own
// top-level nav destination.
function Tabs({ items, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(it => (
        <button
          key={it.id}
          role="tab"
          aria-selected={active === it.id}
          className={`tab-item${active === it.id ? " active" : ""}`}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export { Tabs };
