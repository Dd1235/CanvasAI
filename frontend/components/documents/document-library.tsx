"use client";

import * as React from "react";
import { CheckCircle2, Clock3, Database, FileText, FileUp, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DemoDocument } from "@/lib/canvasai-types";

type Props = {
  documents: DemoDocument[];
};

export function DocumentLibrary({ documents }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState(documents);
  const [query, setQuery] = React.useState("");

  const filteredItems = items.filter((item) => {
    const haystack = [item.title, item.type, item.status, ...item.tags].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const indexedCount = items.filter((item) => item.status === "Indexed").length;
  const chunkCount = items.reduce((total, item) => total + item.chunks, 0);

  const stageFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const staged = files.map<DemoDocument>((file) => ({
      id: `local-${file.name}-${file.size}`,
      title: file.name,
      type: file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "Notes",
      status: "Queued",
      size: formatBytes(file.size),
      chunks: 0,
      updatedAt: "just now",
      tags: ["local"],
    }));

    setItems((currentItems) => [...staged, ...currentItems]);
    toast.success(`${files.length} source${files.length === 1 ? "" : "s"} staged locally`);
    event.target.value = "";
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary">Visual RAG</Badge>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="text-muted-foreground max-w-2xl">
            Sources staged here become retrieval context for Agent 0 and grounding citations for
            the canvas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.md,.txt"
            className="hidden"
            onChange={stageFiles}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" onClick={() => inputRef.current?.click()}>
                <FileUp className="size-4" />
                Stage source
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pick PDFs, markdown, or text files to add to grounding</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Database} label="Indexed sources" value={`${indexedCount}/${items.length}`} />
        <MetricCard icon={FileText} label="Retrieved chunks" value={chunkCount.toString()} />
        <MetricCard icon={Clock3} label="Queue" value={`${items.length - indexedCount}`} />
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Library</CardTitle>
            <CardDescription>Filter staged PDFs, notes, and API references.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sources"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-border divide-y rounded-md border">
            {filteredItems.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{item.title}</p>
                    <Badge variant={item.status === "Indexed" ? "secondary" : "outline"}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {item.type} · {item.size} · {item.chunks} chunks · {item.updatedAt}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info(`${item.title} selected`)}
                    >
                      <CheckCircle2 className="size-4" />
                      Select
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Use this source as canvas grounding</TooltipContent>
                </Tooltip>
              </div>
            ))}
            {!filteredItems.length ? (
              <div className="text-muted-foreground p-8 text-center text-sm">
                {items.length === 0 ? "No sources staged yet — upload to begin." : "No sources match."}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-2 text-2xl">{value}</CardTitle>
        </div>
        <div className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-md">
          <Icon className="size-4" />
        </div>
      </CardHeader>
    </Card>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
