import * as React from "react";

import { cn } from "@/lib/utils";

// Subtle multi-stop gradient on text. Uses currentColor stops so the same
// component reads well in both light and dark themes (the gradient anchors
// to the foreground colour and adds a wash of `--primary` in the middle).
export function GradientText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block bg-clip-text text-transparent",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(110deg, var(--foreground) 10%, var(--primary) 50%, var(--foreground) 90%)",
      }}
    >
      {children}
    </span>
  );
}
