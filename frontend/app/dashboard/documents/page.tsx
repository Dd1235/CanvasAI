import { Metadata } from "next";
// Adjust this import path if your DocumentLibrary is located elsewhere!
import { DocumentLibrary } from "@/components/documents/document-library"; 

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return <DocumentLibrary documents={[]} />;
}