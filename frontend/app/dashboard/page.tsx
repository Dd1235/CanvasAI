import { DashboardHomeClient } from "@/components/dashboard/dashboard-home-client";
import { DEMO_DOCUMENTS, DEMO_SESSIONS } from "@/lib/mock-data";
import { Metadata } from "next";
export const metadata: Metadata = { title: "Overview" };

export default function DashboardHomePage() {
  return <DashboardHomeClient initialSessions={DEMO_SESSIONS} initialDocuments={DEMO_DOCUMENTS} />;
}
