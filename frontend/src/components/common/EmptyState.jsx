import { K, SP } from "./theme.js";

// Intentional empty state — an invitation to act, not a blank panel.
// `action` is optional inline content (e.g. an upload control) rendered
// below the copy.
function EmptyState({ title, description, action = null }) {
  return (
    <div style={{ padding: `${SP.huge}px ${SP.xl}px`, textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: K.text, marginBottom: SP.xs }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: K.textSecondary, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>{description}</div>}
      {action && <div style={{ marginTop: SP.lg }}>{action}</div>}
    </div>
  );
}

export { EmptyState };
