import { CheckCircle2, Circle } from "lucide-react";

import {
  checkPassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth-constants";

/**
 * Live password-rule checklist shown under a new-password field. Each row
 * flips to emerald + a filled check the moment its rule is met, so the user
 * gets continuous feedback instead of a single pass/fail on submit. Shared by
 * the sign-up form and the password-reset form so the two surfaces stay
 * identical. Render only once the user has typed something — a wall of red
 * Xs on an empty field is worse UX than letting them start.
 */
export function PasswordRequirements({ pw }: { pw: string }) {
  const check = checkPassword(pw);
  return (
    <ul
      aria-live="polite"
      className="mb-3 flex flex-col gap-1 font-mono text-[10.5px] uppercase tracking-[0.15em]"
    >
      <RequirementRow ok={check.hasLength} label={`${PASSWORD_MIN_LENGTH}+ characters`} />
      <RequirementRow ok={check.hasLetter} label="At least one letter" />
      <RequirementRow ok={check.hasNumber} label="At least one number" />
    </ul>
  );
}

function RequirementRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700" />
      )}
      <span className={ok ? "text-emerald-700 dark:text-emerald-400" : ""}>
        {label}
      </span>
    </li>
  );
}
