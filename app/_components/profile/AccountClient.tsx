"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOutAllDevices } from "@/app/(auth)/actions";
import { signOut } from "@/app/actions";
import {
  ActionRow,
  DisplayRow,
  Group,
  RowDivider,
} from "./atoms";
import { ChangeEmailForm } from "./account/ChangeEmailForm";
import { ChangePasswordForm } from "./account/ChangePasswordForm";
import { GoogleRow } from "./account/GoogleRow";
import { SignOutAllConfirm } from "./account/SignOutAllConfirm";
import { DeleteAccountConfirm } from "./account/DeleteAccountConfirm";

interface Props {
  email: string;
  // Provider names already connected to this account (e.g. ["google"]).
  // Sourced from supabase.auth.getUserIdentities() in the server page.
  connectedProviders: string[];
}

// Top-level orchestrator for the Account page. Owns the open/close
// state for the inline forms + confirm modals, plus the "pending
// confirmation" pill that surfaces after a successful change-email
// action so the user has a visual trace of their request.
export function AccountClient({ email, connectedProviders }: Props) {
  const search = useSearchParams();
  const router = useRouter();
  const initialOpen = search.get("delete") === "1";
  const [confirmingDelete, setConfirmingDelete] = useState(initialOpen);
  const [confirmingSignOutAll, setConfirmingSignOutAll] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isSigningOut, startSignOut] = useTransition();

  const googleConnected = connectedProviders.includes("google");

  function handleSignOutAll() {
    setConfirmingSignOutAll(false);
    startSignOut(async () => {
      const result = await signOutAllDevices();
      if (result.ok) router.push("/sign-in");
    });
  }

  return (
    <>
      <Group label="EMAIL">
        <DisplayRow label="CURRENT EMAIL" value={email} />
        {pendingEmail && (
          <div className="-mt-1 px-4 pb-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/[0.10] dark:text-amber-400"
              style={{ letterSpacing: "0.16em" }}
            >
              PENDING · {pendingEmail}
            </span>
          </div>
        )}
        <RowDivider />
        {editingEmail ? (
          <ChangeEmailForm
            onClose={() => setEditingEmail(false)}
            onPending={(addr) => setPendingEmail(addr)}
          />
        ) : (
          <ActionRow
            label="Change email"
            tone="accent"
            onClick={() => setEditingEmail(true)}
          />
        )}
      </Group>

      <Group label="PASSWORD">
        {editingPassword ? (
          <ChangePasswordForm onClose={() => setEditingPassword(false)} />
        ) : (
          <ActionRow
            label="Change password"
            tone="accent"
            onClick={() => setEditingPassword(true)}
          />
        )}
      </Group>

      <Group label="CONNECTED ACCOUNTS">
        <GoogleRow connected={googleConnected} />
      </Group>

      <Group label="SESSION">
        <ActionRow
          label={isSigningOut ? "Signing out…" : "Sign out"}
          tone="destructive"
          onClick={() =>
            startSignOut(() => {
              void signOut();
            })
          }
        />
        <RowDivider />
        <ActionRow
          label="Sign out of all devices"
          tone="destructive"
          onClick={() => setConfirmingSignOutAll(true)}
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
      {confirmingSignOutAll && (
        <SignOutAllConfirm
          onConfirm={handleSignOutAll}
          onClose={() => setConfirmingSignOutAll(false)}
        />
      )}
    </>
  );
}
