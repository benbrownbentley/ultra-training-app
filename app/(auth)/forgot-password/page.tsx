import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `Reset password · ${BRAND_NAME}`,
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
