import { AuthSplit } from "@/components/auth/auth-split";

export const metadata = {
  title: "Sign up · Vert",
};

export default function SignUpPage() {
  return <AuthSplit mode="signup" />;
}
