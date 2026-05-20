// Shared auth constraints — referenced from both client-side form
// validation and server-side action checks so the two stay in sync.

// Supabase's default minimum. If you raise the project-level setting in
// the Supabase dashboard, raise this constant too.
export const PASSWORD_MIN_LENGTH = 6;

export const PASSWORD_TOO_SHORT_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
