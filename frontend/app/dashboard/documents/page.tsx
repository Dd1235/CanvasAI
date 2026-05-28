import { DocumentLibrary } from "@/components/documents/document-library";
import { DEMO_DOCUMENTS } from "@/lib/mock-data";
import { Metadata } from "next";
export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return <DocumentLibrary documents={DEMO_DOCUMENTS} />;
}
