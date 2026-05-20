import { AuthSplit } from "@/components/auth/auth-split";
import { signIn, signInWithGoogle } from "../actions";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `Sign in · ${BRAND_NAME}`,
};

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "We couldn't complete that sign-in. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const initialError = params.error ? ERROR_MESSAGES[params.error] : undefined;

  return (
    <AuthSplit
      mode="signin"
      action={signIn}
      googleAction={signInWithGoogle}
      initialError={initialError}
    />
  );
}
