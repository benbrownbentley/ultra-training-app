"use client";

import { useCallback, useState, useTransition } from "react";
import { changePassword } from "@/app/(auth)/actions";
import {
  checkPassword,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth-constants";
import { FormField } from "./FormField";
import { InlineError, InlineSuccess } from "./InlineMessages";

export function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(() => {
    setError(null);
    setSuccess(null);
    if (!checkPassword(newPassword).ok) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    startTransition(async () => {
      const result = await changePassword({ currentPassword, newPassword });
      if (result.ok) {
        setSuccess("Password updated.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(result.error);
      }
    });
  }, [currentPassword, newPassword, confirmPassword]);

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      <FormField
        label="CURRENT PASSWORD"
        type="password"
        value={currentPassword}
        onChange={setCurrentPassword}
        disabled={isPending}
        autoFocus
      />
      <FormField
        label="NEW PASSWORD"
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        disabled={isPending}
      />
      <FormField
        label="CONFIRM NEW PASSWORD"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
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
            currentPassword.length === 0 ||
            newPassword.length === 0
          }
          className="inline-flex h-10 items-center justify-center rounded-[10px] border border-emerald-600 bg-emerald-500 px-3.5 text-[13px] font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Update password"}
        </button>
      </div>
    </div>
  );
}
