import { CanvasWorkbench } from "@/components/canvas/canvas-workbench";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: sessionData } = await supabase
    .from("canvas_sessions")
    .select("title")
    .eq("id", id)
    .single();

  return {
    title: sessionData?.title || `Session ${id.split("-")[0]}`,
  };
}

export default async function CanvasPage({ params }: { params: Params }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: sessionData, error } = await supabase
    .from("canvas_sessions")
    .select("title, neuro_profile")
    .eq("id", id)
    .single();

  if (error) console.error("Supabase Error:", error.message);

  const realTitle = sessionData?.title || `Session ${id.split("-")[0]}`;

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            {realTitle}{" "}
            <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-sm">
              {id}
            </code>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Live AI workspace. Real-time LangGraph processing.
          </p>
        </div>
        {/* <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Active</Badge>
          <Badge variant="outline">Connected</Badge>
        </div> */}
      </div>
      <div className="min-h-0 flex-1">
        <CanvasWorkbench sessionId={id} topic={realTitle} initialProfile={sessionData?.neuro_profile}/>
      </div>
    </div>
  );
}
