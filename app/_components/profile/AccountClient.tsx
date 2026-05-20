"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { deleteAccount, signOut } from "@/app/actions";

// isClient hook — keeps the portal off the server render without tripping
// the setState-in-effect lint rule.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
import {
  ActionRow,
  DisplayRow,
  Group,
  RowDivider,
} from "./atoms";

interface Props {
  email: string;
}

// Wires up the Account page's interactive bits: sign-out CTA, delete-account
// flow (modal with email-typing friction). Connected-accounts + recent
// sign-ins are visual stubs because Supabase doesn't expose a usable session
// list yet.
export function AccountClient({ email }: Props) {
  const search = useSearchParams();
  const initialOpen = search.get("delete") === "1";
  const [confirmingDelete, setConfirmingDelete] = useState(initialOpen);
  const [isSigningOut, startSignOut] = useTransition();

  return (
    <>
      <Group label="EMAIL">
        <DisplayRow label="CURRENT EMAIL" value={email} />
      </Group>

      <Group label="PASSWORD">
        <ActionRow
          label="Change password"
          tone="accent"
          href="/sign-in?reset=1"
        />
      </Group>

      <Group label="SESSION">
        <ActionRow
          label={isSigningOut ? "Signing out…" : "Sign out"}
          onClick={() =>
            startSignOut(() => {
              void signOut();
            })
          }
        />
        <RowDivider />
        <ActionRow
          label="Delete account"
          tone="destructive"
          onClick={() => setConfirmingDelete(true)}
        />
      </Group>

      {confirmingDelete && (
        <DeleteAccountConfirm
          email={email}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}

function DeleteAccountConfirm({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isClient = useIsClient();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  if (!isClient) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 font-sans">
      <button
        type="button"
        onClick={isPending ? undefined : onClose}
        aria-label="Close"
        className="absolute inset-0 bg-zinc-950/45 dark:bg-black/60"
      />
      <div className="absolute right-0 bottom-0 left-0 rounded-t-[20px] bg-zinc-50 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),22px)] shadow-[0_-16px_48px_rgba(0,0,0,0.35)] sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:w-[480px] sm:max-w-[92%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:p-6 dark:bg-zinc-950 dark:sm:border-zinc-800">
        <div className="flex justify-center pb-3.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div
          className="font-mono text-[10.5px] font-semibold uppercase text-red-600 dark:text-red-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — DELETE ACCOUNT
        </div>
        <h2
          className="m-0 mt-2 mb-2 text-[22px] font-medium text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.015em" }}
        >
          This can&apos;t be undone.
        </h2>
        <p className="m-0 mb-4 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
          This will permanently delete your account, all your training data,
          and your Journal entries.
        </p>
        <label
          htmlFor="confirm-email"
          className="m-0 mb-1.5 block font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          TYPE YOUR EMAIL TO CONFIRM
        </label>
        <input
          id="confirm-email"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={isPending}
          autoFocus
          className="block w-full rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
        />
        <span
          className="mt-1.5 block font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.14em" }}
        >
          EXPECTED: {email}
        </span>
        {error && (
          <div className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-[14px] font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await deleteAccount(typed);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Failed to delete account",
                  );
                }
              });
            }}
            disabled={isPending || !matches}
            className="inline-flex h-11 items-center justify-center rounded-[10px] border border-red-700 bg-red-600 px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(220,38,38,0.28)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isPending ? "Deleting…" : "Permanently delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
