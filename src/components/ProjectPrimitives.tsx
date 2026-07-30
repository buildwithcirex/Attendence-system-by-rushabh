// Small shared UI primitives for the Linear-style project views: identity avatars,
// a progress ring, and a project-status glyph. Kept presentational and dependency-free
// so the dashboard and other views can reuse them.
import { CircleDashed, CircleCheck, Archive } from "lucide-react";

type ProjectStatus = "active" | "completed" | "archived";

// Deterministic hue from a name so a member's avatar colour is stable everywhere.
function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  const hue = hueFromName(name);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `hsl(${hue} 45% 24%)`,
        color: `hsl(${hue} 70% 82%)`,
        letterSpacing: 0,
      }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// SVG completion ring. Animates the arc when `value` changes (transitions retarget
// smoothly, unlike keyframes). Neutral until complete, then vanilla accent.
export function ProgressRing({
  value,
  size = 16,
  showLabel = false,
}: {
  value: number;
  size?: number;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const complete = pct >= 100;
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(241,254,200,0.14)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={complete ? "var(--color-accent)" : "var(--color-muted)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset 400ms cubic-bezier(0.23,1,0.32,1), stroke 200ms ease" }}
        />
      </svg>
      {showLabel && <span className="text-xs tabular-nums text-faint">{pct}%</span>}
    </span>
  );
}

const STATUS_ICON: Record<ProjectStatus, { Icon: typeof CircleDashed; className: string; label: string }> = {
  active: { Icon: CircleDashed, className: "text-amber-400", label: "Active" },
  completed: { Icon: CircleCheck, className: "text-emerald-400", label: "Completed" },
  archived: { Icon: Archive, className: "text-faint", label: "Archived" },
};

export function ProjectStatusIcon({ status, size = 16 }: { status: ProjectStatus; size?: number }) {
  const { Icon, className, label } = STATUS_ICON[status];
  return <Icon width={size} height={size} className={className} aria-label={label} />;
}

export const PROJECT_STATUS_META = STATUS_ICON;
