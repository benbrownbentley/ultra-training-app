import { AuthSplit } from "@/components/auth/auth-split";

export const metadata = {
  title: "Sign in · Vert",
};

export default function SignInPage() {
  return <AuthSplit mode="signin" />;
}
