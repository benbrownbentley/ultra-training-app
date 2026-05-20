"use client";

import { useCallback, useState, useTransition } from "react";
import { changeEmail } from "@/app/(auth)/actions";
import { FormField } from "./FormField";
import { InlineError, InlineSuccess } from "./InlineMessages";

interface Props {
  onClose: () => void;
  // Called with the submitted new email after a successful action so the
  // parent can render a "pending confirmation" pill on the EMAIL row.
  onPending: (email: string) => void;
}

export function ChangeEmailForm({ onClose, onPending }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(() => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await changeEmail({ newEmail, currentPassword });
      if (result.ok) {
        setSuccess(
          "Check both inboxes — Supabase sent a confirmation link to each address.",
        );
        onPending(newEmail.trim());
        setNewEmail("");
        setCurrentPassword("");
      } else {
        setError(result.error);
      }
    });
  }, [newEmail, currentPassword, onPending]);

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      <FormField
        label="NEW EMAIL"
        type="email"
        value={newEmail}
        onChange={setNewEmail}
        disabled={isPending}
        autoFocus
      />
      <FormField
        label="CURRENT PASSWORD"
        type="password"
        value={currentPassword}
        onChange={setCurrentPassword}
        disabled={isPending}
      />
      {error && <InlineError>{error}</InlineError>}
      {success && <InlineSuccess>{success}</InlineSuccess>}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={
            isPending ||
            newEmail.trim().length === 0 ||
            currentPassword.length === 0
          }
          className="inline-flex h-10 items-center justify-center rounded-[10px] border border-emerald-600 bg-emerald-500 px-3.5 text-[13px] font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Send confirmation"}
        </button>
      </div>
    </div>
  );
}
