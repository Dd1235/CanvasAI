import { createClient } from "@/lib/supabase/server";

import { SiteHeader } from "@/components/blocks/site-header";
import { Hero } from "@/components/blocks/hero";
import { StatsStrip } from "@/components/blocks/stats-strip";
import { StackMarquee } from "@/components/blocks/stack-marquee";
import { FeatureBento } from "@/components/blocks/feature-bento";
import { AgentPipeline } from "@/components/blocks/agent-pipeline";
import { LandingCTA } from "@/components/blocks/landing-cta";
import { SiteFooter } from "@/components/blocks/site-footer";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <SiteHeader isAuthed={Boolean(user)} />
      <main className="overflow-hidden">
        <Hero />
        <StatsStrip />
        <StackMarquee />
        <FeatureBento />
        <AgentPipeline />
        <LandingCTA />
      </main>
      <SiteFooter />
    </>
  );
}
