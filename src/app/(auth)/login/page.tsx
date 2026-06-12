import { Suspense } from "react";
import { googleAuthEnabled } from "@/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm googleEnabled={googleAuthEnabled} />
    </Suspense>
  );
}
