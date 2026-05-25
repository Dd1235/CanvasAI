import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type UseKnowledgeGraphJobProps = {
  buildId: string | null;
  onSuccess: () => void;
  onError: () => void;
};

export function useKnowledgeGraphJob({ buildId, onSuccess, onError }: UseKnowledgeGraphJobProps) {
  useEffect(() => {
    // If there is no active job, do nothing
    if (!buildId) return;

    const supabase = createClient();
    
    // Set up the Realtime subscription
    const channel = supabase
      .channel(`kg_build_${buildId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "kg_build_jobs",
          filter: `id=eq.${buildId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          if (newStatus === "completed") {
            onSuccess();
          } else if (newStatus === "failed") {
            onError();
          }
        }
      )
      .subscribe();

    // The Cleanup Function: This ensures no memory leaks if the component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [buildId, onSuccess, onError]);
}