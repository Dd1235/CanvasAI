import { DashboardHomeClient } from "@/components/dashboard/dashboard-home-client";
import { Metadata } from "next";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardHomePage() {
  return <DashboardHomeClient />;
}