// Top-bar nav item — plain text, underline active state (bottom border +
// stronger weight), no icon. Icons were dropped from primary navigation
// deliberately: at six items, text alone reads faster than icon+label
// ever did, and it keeps the bar from looking like a mobile tab strip.
function NavItem({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`topbar-nav-item${active ? " active" : ""}`}>
      {label}
    </button>
  );
}

export { NavItem };
