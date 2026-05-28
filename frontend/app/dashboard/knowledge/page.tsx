import { KnowledgeGraphBoard } from "@/components/knowledge/knowledge-graph-board";
import { Metadata } from "next";
export const metadata: Metadata = { title: "Knowledge Graph" };

export default function KnowledgeGraphPage() {
  return <KnowledgeGraphBoard />;
}
