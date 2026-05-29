import Link from "next/link";
import { Sparkles } from "lucide-react";

import { SignupForm } from "@/components/forms/signup-form";
import { Metadata } from "next";
export const metadata: Metadata = { title: "Sign Up" };

export default function SignupPage() {
  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="text-foreground mb-8 inline-flex items-center gap-2 text-lg font-semibold"
      >
        <Sparkles className="size-5" />
        CanvasAI
      </Link>
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </main>
  );
}
