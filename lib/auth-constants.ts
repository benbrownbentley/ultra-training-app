// Shared auth constraints — referenced from both client-side form validation
// and server-side action checks so the two stay in sync. Server-side enforcement
// lives in Supabase Auth Settings; raise these constants in lockstep with the
// dashboard setting.

export const PASSWORD_MIN_LENGTH = 8;

// One letter (a-z or A-Z) and one digit (0-9). No symbol required — keeps the
// rules memorable while still catching the worst passwords ("12345678", "password").
export const PASSWORD_HAS_LETTER = /[A-Za-z]/;
export const PASSWORD_HAS_NUMBER = /\d/;

export interface PasswordCheck {
  ok: boolean;
  hasLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
}

export function checkPassword(pw: string): PasswordCheck {
  const hasLength = pw.length >= PASSWORD_MIN_LENGTH;
  const hasLetter = PASSWORD_HAS_LETTER.test(pw);
  const hasNumber = PASSWORD_HAS_NUMBER.test(pw);
  return {
    ok: hasLength && hasLetter && hasNumber,
    hasLength,
    hasLetter,
    hasNumber,
  };
}

export const PASSWORD_REQUIREMENTS_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include a letter and a number.`;

// Kept for backwards-compat with changePassword's pre-existing short-circuit.
// Prefer checkPassword() for new code.
export const PASSWORD_TOO_SHORT_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
