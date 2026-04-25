import Link from "next/link";
import { Sparkles } from "lucide-react";

import { LoginForm } from "@/components/forms/login-form";

type SearchParams = Promise<{ next?: string; notice?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, notice, error } = await searchParams;

  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="text-foreground mb-8 inline-flex items-center gap-2 text-lg font-semibold"
      >
        <Sparkles className="size-5" />
        CanvasAI
      </Link>
      {notice === "check-email" ? (
        <p className="text-muted-foreground mb-4 text-sm">
          Check your email to confirm your account before signing in.
        </p>
      ) : null}
      {error ? <p className="text-destructive mb-4 text-sm">{error}</p> : null}
      <div className="w-full max-w-sm">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
