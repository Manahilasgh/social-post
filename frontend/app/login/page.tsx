import AuthForm from "@/components/auth/auth-form";

export const metadata = { title: "Log in — Social Post" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
