import { AuthSplit } from "@/components/auth/auth-split";
import { signUp, signInWithGoogle } from "../actions";

export const metadata = {
  title: "Sign up · Vert",
};

export default function SignUpPage() {
  return (
    <AuthSplit mode="signup" action={signUp} googleAction={signInWithGoogle} />
  );
}
