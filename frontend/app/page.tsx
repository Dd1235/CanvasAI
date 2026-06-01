import { createClient } from "@/lib/supabase/server";

import { SiteHeader } from "@/components/blocks/site-header";
import { Hero } from "@/components/blocks/hero";
import { Features } from "@/components/blocks/features";
import { Workflow } from "@/components/blocks/workflow";
import { SiteFooter } from "@/components/blocks/site-footer";

import SplineScene from "@/components/spline-scene";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">

      <div className="fixed inset-0 z-0">
        <SplineScene />
      </div>

      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black via-black/10 to-transparent" />

      <div className="relative z-20">

        <SiteHeader isAuthed={Boolean(user)} />

        <main className="overflow-hidden">

          <div className="relative z-20 flex min-h-screen items-center">

            <div className="w-full max-w-3xl pl-16">
              <Hero />
            </div>

          </div>

          <Features />
          <Workflow />

        </main>

        <SiteFooter />

      </div>
    </div>
  );
}