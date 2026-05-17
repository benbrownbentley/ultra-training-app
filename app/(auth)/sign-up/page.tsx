import { AuthSplit } from "@/components/auth/auth-split";
import { signUp } from "../actions";

export const metadata = {
  title: "Sign up · Vert",
};

export default function SignUpPage() {
  return <AuthSplit mode="signup" action={signUp} />;
}
