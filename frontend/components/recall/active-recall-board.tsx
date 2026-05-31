"use client";

import * as React from "react";
import { BookOpenCheck, CalendarClock, Layers3, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MagicContainer, MagicCard } from "@/components/ui/magic-bento";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  deleteSessionRecallCards,
  getActiveRecallStats,
  listActiveRecallSessions,
  reviewRecallCard,
} from "@/lib/canvasai-api";
import type {
  ActiveRecallCard,
  ActiveRecallSessionGroup,
  ActiveRecallStats,
} from "@/lib/canvasai-types";

const RATINGS = [
  { id: "again", label: "Again", hint: "I couldn't recall it — reset the interval." },
  { id: "hard", label: "Hard", hint: "I got it but with effort — shorten the next interval." },
  { id: "good", label: "Good", hint: "Solid recall — schedule the standard interval." },
  { id: "easy", label: "Easy", hint: "Trivial — push the next interval out further." },
] as const;

export function ActiveRecallBoard() {
  const [groups, setGroups] = React.useState<ActiveRecallSessionGroup[]>([]);
  const [stats, setStats] = React.useState<ActiveRecallStats | null>(null);
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [nextGroups, nextStats] = await Promise.all([
        listActiveRecallSessions({ dueOnly: false }),
        getActiveRecallStats(),
      ]);
      setGroups(nextGroups);
      setStats(nextStats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Active recall backend unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const review = async (cardId: string, rating: (typeof RATINGS)[number]["id"]) => {
    try {
      const updated = await reviewRecallCard(cardId, rating);
      setGroups((current) => replaceCard(current, updated));
      setRevealed(null);
      toast.success("Review scheduled");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed.");
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const result = await deleteSessionRecallCards(sessionId);
      setGroups((current) => current.filter((group) => group.session_id !== sessionId));
      toast.success(`Deleted ${result.deleted} card${result.deleted === 1 ? "" : "s"}`);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary">Session grouped</Badge>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">Active Recall</h1>
          <p className="text-muted-foreground max-w-2xl">
            Review cards generated from each canvas session. Step-by-step replay stays on the
            canvas deck; recall keeps the session-level prompts that matter later.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={() => void load()}>
              <RotateCcw className="size-4" />
              Refresh
            </Button>
          </TooltipTrigger>
          <TooltipContent>Re-fetch recall cards and due counts</TooltipContent>
        </Tooltip>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Total cards" value={stats?.total_cards ?? 0} />
        <Metric label="Due now" value={stats?.due_cards ?? 0} />
        <Metric label="Sessions" value={stats?.sessions ?? 0} />
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading cards
        </div>
      ) : null}

      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.session_id} className="bg-card border-border rounded-lg border">
            <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers3 className="size-4" />
                  <h2 className="truncate text-base font-semibold">{group.session_title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{group.session_id}</Badge>
                  <Badge variant="secondary">{group.card_count} cards</Badge>
                  <Badge variant={group.due_count ? "default" : "outline"}>
                    {group.due_count} due
                  </Badge>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete recall cards for ${group.session_title}`}
                    onClick={() => deleteSession(group.session_id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete every recall card from this session</TooltipContent>
              </Tooltip>
            </div>

            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {group.cards.map((card) => (
                <RecallCard
                  key={card.id}
                  card={card}
                  revealed={revealed === card.id}
                  onReveal={() => setRevealed(card.id)}
                  onReview={(rating) => review(card.id, rating)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!loading && !groups.length ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            No cards yet. Open a canvas session and click Add recall.
          </CardContent>
        </Card>
      ) : null}
    </div>
    </TooltipProvider>
  );
}
function RecallCard({
  card,
  revealed,
  onReveal,
  onReview,
}: {
  card: ActiveRecallCard;
  revealed: boolean;
  onReveal: () => void;
  onReview: (rating: (typeof RATINGS)[number]["id"]) => void;
}) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-card p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="size-4 shrink-0 text-[#0A66C2]" />
              <h3 className="text-sm font-medium">Card</h3>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Due {new Date(card.due_at).toLocaleDateString()} · EF {card.ease_factor}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <p className="font-medium">{card.front}</p>
          {revealed ? <p className="text-[#0A66C2] dark:text-blue-400 text-sm font-medium p-3 bg-[#0A66C2]/5 rounded-md border border-[#0A66C2]/10">{card.back}</p> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {card.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="bg-background">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {revealed ? (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((rating) => (
            <Tooltip key={rating.id}>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onReview(rating.id)}
                  className="hover:text-[#0A66C2] hover:border-[#0A66C2] hover:bg-[#0A66C2]/10 transition-colors"
                >
                  {rating.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{rating.hint}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              className="mt-5 w-fit hover:text-[#0A66C2] hover:border-[#0A66C2] hover:bg-[#0A66C2]/10 transition-colors" 
              variant="outline" 
              onClick={onReveal}
            >
              <CalendarClock className="size-4 mr-2" />
              Reveal
            </Button>
          </TooltipTrigger>
          <TooltipContent>Show the back of the card before grading recall</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-xl bg-card text-card-foreground shadow-sm border border-black/10 dark:border-white/10 hover:shadow-md transition-shadow">
      <CardHeader>
        <CardDescription className="font-medium uppercase tracking-wider text-[10px] text-muted-foreground">{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold text-[#0A66C2] dark:text-white">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function replaceCard(groups: ActiveRecallSessionGroup[], updated: ActiveRecallCard) {
  const now = Date.now();
  return groups.map((group) => {
    if (group.session_id !== updated.session_id) return group;
    const cards = group.cards.map((card) => (card.id === updated.id ? updated : card));
    return {
      ...group,
      cards,
      due_count: cards.filter((card) => new Date(card.due_at).getTime() <= now).length,
    };
  });
}
