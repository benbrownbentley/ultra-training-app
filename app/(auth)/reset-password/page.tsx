import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `Set a new password · ${BRAND_NAME}`,
};

// Server component shell — it only reads the recovery token_hash from the URL
// and hands off to a client form, which must call client-side Supabase
// (verifyOtp) to establish the recovery session.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm tokenHash={params.token_hash} type={params.type} />;
}
