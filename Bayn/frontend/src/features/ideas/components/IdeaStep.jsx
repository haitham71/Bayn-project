// One form step: an optional circled index + title + note, then its field(s).
// Shared by the create-idea and edit-idea pages (uses the ci__ layout styles).
// Omit `n` to drop the number (and its indent) — used by the edit page.
export default function IdeaStep({ n, title, note, children }) {
  return (
    <section className={`ci__step${n == null ? ' ci__step--no-num' : ''}`}>
      <div className="ci__step-head">
        {n != null && <span className="ci__step-num">{n}</span>}
        <h2 className="ci__step-title">{title}</h2>
      </div>
      {note && <p className="ci__step-note">{note}</p>}
      <div className="ci__step-body">{children}</div>
    </section>
  );
}
