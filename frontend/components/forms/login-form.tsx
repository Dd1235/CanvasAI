"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.email({ message: "Enter a valid email." }),
  password: z.string().min(8, { message: "At least 8 characters." }),
});
type Values = z.infer<typeof schema>;

function getEmailRedirectTo(next?: string) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next || "/dashboard");
  return url.toString();
}

function isEmailNotConfirmed(error: { code?: string; message: string }) {
  return (
    error.code === "email_not_confirmed" ||
    error.message.toLowerCase().includes("email not confirmed")
  );
}

export function LoginForm({
  className,
  next,
  ...props
}: React.ComponentProps<"div"> & { next?: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [confirmationEmail, setConfirmationEmail] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        if (isEmailNotConfirmed(error)) {
          setConfirmationEmail(values.email);
          toast.error("Email not confirmed.", {
            description: "Resend the confirmation email, then open the newest link.",
          });
          return;
        }
        toast.error(error.message);
        return;
      }
      toast.success("Signed in.");
      router.push(next || "/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmationEmail) return;
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: getEmailRedirectTo(next) },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Confirmation email sent.", {
        description: "Use the newest link. Older Supabase links can expire.",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your email below to login to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="********"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Login"}
              </Button>
              {confirmationEmail ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={resending}
                  onClick={resendConfirmation}
                >
                  {resending ? <Loader2 className="size-4 animate-spin" /> : "Resend confirmation"}
                </Button>
              ) : null}
              <p className="text-muted-foreground text-center text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-foreground underline underline-offset-4">
                  Sign up
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
