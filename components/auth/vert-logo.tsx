import { cn } from "@/lib/utils";

interface VertLogoProps {
  size?: "md" | "lg";
  className?: string;
}

export function VertLogo({ size = "md", className }: VertLogoProps) {
  const big = size === "lg";
  return (
    <div className={cn("flex items-center", big ? "gap-3" : "gap-2.5", className)}>
      <svg
        width={big ? 28 : 22}
        height={big ? 28 : 22}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 18 L7 10 L11 14 L15 6 L19 12 L22 8"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15" cy="6" r="1.8" fill="#10b981" />
      </svg>
      <span
        className={cn(
          "font-mono font-semibold uppercase tracking-[0.12em]",
          big ? "text-lg" : "text-sm",
        )}
      >
        VERT
      </span>
    </div>
  );
}
