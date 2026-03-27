/**
 * CharlesMascot — a friendly 2D robot avatar for the ETF IQ assistant.
 *
 * Inspired by Claude's conversational mascot but themed for finance:
 * rounded head with antenna, friendly eyes, subtle gold accent.
 * Pure SVG — no external deps.
 */

interface Props {
  size?: number;
  className?: string;
}

export function CharlesMascot({ size = 80, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Charles mascot"
    >
      {/* Antenna stem */}
      <line x1="60" y1="28" x2="60" y2="16" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
      {/* Antenna tip — pulsing gold dot */}
      <circle cx="60" cy="13" r="4" fill="#C9A84C">
        <animate attributeName="opacity" values="1;0.4;1" dur="2.5s" repeatCount="indefinite" />
      </circle>

      {/* Head — rounded rectangle */}
      <rect x="28" y="28" width="64" height="56" rx="20" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="2" />

      {/* Face plate — inner shape */}
      <rect x="36" y="36" width="48" height="36" rx="12" fill="var(--color-muted)" opacity="0.45" />

      {/* Left eye */}
      <ellipse cx="48" cy="52" rx="6" ry="7" fill="var(--color-foreground)">
        <animate attributeName="ry" values="7;1;7" dur="4s" begin="1.5s" repeatCount="indefinite" />
      </ellipse>
      {/* Left eye highlight */}
      <circle cx="50" cy="49" r="2" fill="var(--color-card)" />

      {/* Right eye */}
      <ellipse cx="72" cy="52" rx="6" ry="7" fill="var(--color-foreground)">
        <animate attributeName="ry" values="7;1;7" dur="4s" begin="1.5s" repeatCount="indefinite" />
      </ellipse>
      {/* Right eye highlight */}
      <circle cx="74" cy="49" r="2" fill="var(--color-card)" />

      {/* Mouth — friendly smile */}
      <path
        d="M50 64 Q60 72 70 64"
        stroke="#C9A84C"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left ear */}
      <rect x="20" y="46" width="8" height="16" rx="4" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Right ear */}
      <rect x="92" y="46" width="8" height="16" rx="4" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="1.5" />

      {/* Body — small rounded shape below head */}
      <rect x="40" y="86" width="40" height="22" rx="10" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="2" />

      {/* Body accent stripe */}
      <rect x="52" y="92" width="16" height="4" rx="2" fill="#C9A84C" opacity="0.6" />

      {/* Neck connector */}
      <rect x="52" y="82" width="16" height="6" rx="3" fill="var(--color-border)" />
    </svg>
  );
}
