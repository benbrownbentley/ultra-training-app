import { AuthSplit } from "@/components/auth/auth-split";
import { signIn } from "../actions";

export const metadata = {
  title: "Sign in · Vert",
};

export default function SignInPage() {
  return <AuthSplit mode="signin" action={signIn} />;
}
