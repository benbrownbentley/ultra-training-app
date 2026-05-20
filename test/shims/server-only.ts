// Empty shim for the `server-only` package. Vitest aliases the
// real module here (see vitest.config.ts) so importing
// `lib/claude.ts` from a test doesn't trip the runtime guard that
// `server-only` installs for client-bundle builds. No-op at runtime.
export {};
