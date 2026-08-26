// Sidebar nav row — icon + readable label, no cryptic 3-letter codes.
// The icon stays visible in the mobile top-bar (label hides via CSS),
// so it also acts as the compact/collapsed identifier.
function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`nav-item${active ? " active" : ""}`} title={label}>
      {Icon && <span className="nav-icon"><Icon /></span>}
      <span className="nav-item-label">{label}</span>
    </button>
  );
}

export { NavItem };
