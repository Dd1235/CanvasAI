import { SignupForm } from "@/components/forms/signup-form";
import { AnimatedLoginWrapper } from "@/components/animated-login-wrapper";
import { Metadata } from "next";

export const metadata: Metadata = { title: "Sign Up" };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      
      <div className="w-full max-w-sm">
        <AnimatedLoginWrapper>
          <SignupForm />
        </AnimatedLoginWrapper>
      </div>

    </main>
  );
}