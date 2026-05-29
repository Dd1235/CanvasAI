import { LoginForm } from "@/components/forms/login-form";
import { AnimatedLoginWrapper } from "@/components/animated-login-wrapper";
import { Metadata } from "next";
export const metadata: Metadata = { title: "Login" };
type SearchParams = Promise<{ next?: string; notice?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, notice, error } = await searchParams;

  return (
    <AnimatedLoginWrapper>
      {/* Notice Message */}
      {notice === "check-email" ? (
        <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 text-center">
          <p className="text-primary text-sm font-medium">
            Check your email to confirm your account before signing in.
          </p>
        </div>
      ) : null}
      
      {/* Error Message */}
      {error ? (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      ) : null}

      {/* Your existing LoginForm component - untouched! */}
      <LoginForm next={next} />
    </AnimatedLoginWrapper>
  );
}