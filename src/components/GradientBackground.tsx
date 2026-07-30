// Decorative animated mesh-gradient. Purely presentational (no interactivity),
// so it stays a server component. Styles live in globals.css (.gradient-bg).
export function GradientBackground() {
  return (
    <div className="gradient-bg" aria-hidden="true">
      <span className="blob-1" />
      <span className="blob-2" />
      <span className="blob-3" />
    </div>
  );
}
