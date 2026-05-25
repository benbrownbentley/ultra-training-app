// Shared journal UI atoms — chips, dashed dividers, section header.
// Kept in one file so the route components can import a small surface.

interface ChipProps {
  active?: boolean;
  multi?: boolean;
  size?: "md" | "lg";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

// Reused for filter chips, body-part / pain-quality / restrictions
// selectors, and travel-impact selectors. `multi` flips a check glyph on
// when active so multi-select rows look distinct from single-select ones.
export function Chip({
  active,
  multi,
  size = "md",
  type = "button",
  onClick,
  disabled,
  children,
}: ChipProps) {
  const padding = size === "lg" ? "px-3.5 py-2" : "px-3 py-1.5";
  const fontSize = size === "lg" ? "text-[13.5px]" : "text-[12.5px]";
  // For multi-select chips we reserve space for the check glyph in both
  // active and inactive states so toggling a chip doesn't shift its
  // siblings left/right. Inactive renders the same SVG slot with
  // `visibility: hidden` so the box still occupies width.
  if (active) {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500 bg-emerald-500 ${padding} ${fontSize} font-semibold text-emerald-950 transition active:scale-[0.97] disabled:opacity-50`}
      >
        {multi && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 12l5 5L20 7"
              stroke="#052e1f"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-200 bg-transparent ${padding} ${fontSize} font-medium text-zinc-950 transition active:scale-[0.97] hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700`}
    >
      {multi && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="invisible"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
      {children}
    </button>
  );
}

// "SEEN" / "PENDING" badge on every entry card — surfaces whether the
// entry has been fed into a plan regeneration yet.
export function ConsumedBadge({ consumed }: { consumed: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9.5px] font-semibold uppercase ${
        consumed
          ? "text-emerald-500"
          : "text-zinc-400 dark:text-zinc-600"
      }`}
      style={{ letterSpacing: "0.14em" }}
    >
      {consumed ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12l5 5L20 7"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span className="inline-block h-2 w-2 rounded-full border-[1.5px] border-current" />
      )}
      {consumed ? "SEEN" : "PENDING"}
    </span>
  );
}

export function FormSectionLabel({
  children,
  required,
  className,
}: {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[10px] uppercase text-zinc-500 ${className ?? ""}`}
      style={{ letterSpacing: "0.2em" }}
    >
      {children}
      {required && <span className="ml-1 text-emerald-500">*</span>}
    </span>
  );
}
