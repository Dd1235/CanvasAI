import { DocumentLibrary } from "@/components/documents/document-library";
import { DEMO_DOCUMENTS } from "@/lib/mock-data";

export default function DocumentsPage() {
  return <DocumentLibrary documents={DEMO_DOCUMENTS} />;
}
