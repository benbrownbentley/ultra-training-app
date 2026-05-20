import { AuthSplit } from "@/components/auth/auth-split";
import { signUp, signInWithGoogle } from "../actions";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `Sign up · ${BRAND_NAME}`,
};

export default function SignUpPage() {
  return (
    <AuthSplit mode="signup" action={signUp} googleAction={signInWithGoogle} />
  );
}
