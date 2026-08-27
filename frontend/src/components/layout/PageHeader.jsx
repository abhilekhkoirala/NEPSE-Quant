// Per-page header: a real title plus one short line of context (e.g.
// "Ensemble · Last run 20:08") — not a repeated paragraph of
// explanatory copy. `right` renders compact controls (search, filters,
// a primary action) aligned to the far edge.
function PageHeader({ title, subtitle = null, right = null }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-header-title">{title}</div>
        {subtitle && <div className="page-header-subtitle">{subtitle}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

export { PageHeader };
