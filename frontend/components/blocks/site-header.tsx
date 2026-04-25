"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Sparkles, X } from "lucide-react";
import { useScroll } from "motion/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";

type Props = { isAuthed: boolean };

export function SiteHeader({ isAuthed }: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const { scrollYProgress } = useScroll();

  React.useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => setScrolled(v > 0.02));
    return () => unsub();
  }, [scrollYProgress]);

  return (
    <header>
      <nav
        data-state={menuOpen ? "active" : undefined}
        className={cn(
          "group fixed inset-x-0 top-0 z-30 w-full border-b border-transparent transition-colors duration-200",
          scrolled && "border-border/60 bg-background/70 backdrop-blur-xl",
        )}
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
            <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
              <Link href="/" aria-label="home" className="flex items-center gap-2">
                <Sparkles className="size-5" />
                <span className="font-semibold">CanvasAI</span>
              </Link>

              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <Menu className="m-auto size-6 duration-200 group-data-[state=active]:scale-0 group-data-[state=active]:rotate-180 group-data-[state=active]:opacity-0" />
                <X className="absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200 group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100" />
              </button>
            </div>

            <div className="bg-background mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 group-data-[state=active]:block md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none lg:group-data-[state=active]:flex dark:lg:bg-transparent">
              <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center md:w-fit">
                <a href="#features" className="text-muted-foreground hover:text-foreground text-sm">
                  Features
                </a>
                <a href="#workflow" className="text-muted-foreground hover:text-foreground text-sm">
                  Workflow
                </a>
                <ThemeToggle />
                {isAuthed ? (
                  <ButtonGroup aria-label="Auth actions">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard">Dashboard</Link>
                    </Button>
                    <LogoutButton />
                  </ButtonGroup>
                ) : (
                  <ButtonGroup aria-label="Auth actions">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/signup">Sign up</Link>
                    </Button>
                  </ButtonGroup>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
