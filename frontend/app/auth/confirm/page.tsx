import Link from "next/link";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { Metadata } from "next";
export const metadata: Metadata = { title: "Confirm Email" };

type SearchParams = Promise<{
  token_hash?: string;
  type?: EmailOtpType;
  next?: string;
}>;

function safeNextPath(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

async function confirmEmail(formData: FormData) {
  "use server";

  const tokenHash = formData.get("token_hash");
  const type = formData.get("type");
  const next = safeNextPath(formData.get("next"));

  if (typeof tokenHash !== "string" || typeof type !== "string") {
    redirect("/login?error=missing_confirmation_token");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
}

export default async function ConfirmEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const canConfirm = Boolean(tokenHash && type);

  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="text-foreground mb-8 inline-flex items-center gap-2 text-lg font-semibold"
      >
        <Sparkles className="size-5" />
        CanvasAI
      </Link>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Confirm your email</CardTitle>
          <CardDescription>
            Continue to activate your account and open your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canConfirm ? (
            <form action={confirmEmail} className="space-y-4">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next ?? "/dashboard"} />
              <Button type="submit" className="w-full">
                Confirm email
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                This button protects one-time links from email security scanners.
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                This confirmation link is missing its token. Request a new confirmation email from
                the login page.
              </p>
              <Button asChild className="w-full" variant="outline">
                <Link href="/login">Back to login</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
