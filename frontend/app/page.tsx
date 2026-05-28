import { createClient } from "@/lib/supabase/server";

import { SiteHeader } from "@/components/blocks/site-header";
import { Hero } from "@/components/blocks/hero";
import { Features } from "@/components/blocks/features";
import { Workflow } from "@/components/blocks/workflow";
import { SiteFooter } from "@/components/blocks/site-footer";
import { Metadata } from "next";
export const metadata: Metadata = { title: "Home" };

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
        <Features />
        <Workflow />
      </main>
      <SiteFooter />
    </>
  );
}
