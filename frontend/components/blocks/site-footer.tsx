import Link from "next/link";
import { ExternalLink, GitFork, Mail, Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-border/50 bg-background/60 relative border-t backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="text-primary size-6" />
            <span className="text-xl font-semibold">CanvasAI</span>
          </div>
          <p className="text-muted-foreground max-w-md text-sm">
            Stateful, interactive visual tutoring. Built for inside-out engineering mechanics —
            pointer manipulation, memory layout, deep DSA.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm font-medium">
          <Link
            href="/#features"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            Features
          </Link>
          <Link
            href="/#workflow"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            Workflow
          </Link>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            Login
          </Link>
        </div>

        <div className="mt-8 flex justify-center gap-5">
          <Link
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <GitFork className="size-5 transition-transform hover:scale-110" />
          </Link>
          <Link
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="size-5 transition-transform hover:scale-110" />
          </Link>
          <Link
            href="mailto:hello@canvasai.app"
            aria-label="Email"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <Mail className="size-5 transition-transform hover:scale-110" />
          </Link>
        </div>

        <div className="via-border/50 my-8 h-px w-full bg-linear-to-r from-transparent to-transparent" />

        <span className="text-muted-foreground block text-center text-xs">
          © {new Date().getFullYear()} CanvasAI. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
