// Em-dash mono label wrapper used between content blocks (LOG, NOTES, etc.).
// Matches the section-label convention used everywhere else in the app.
export function Section({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 pb-1.5 pt-3.5 sm:px-5">
      <div className="mb-3 flex items-baseline justify-between">
        <span
          className="whitespace-nowrap font-mono text-[10.5px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — {label}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}
