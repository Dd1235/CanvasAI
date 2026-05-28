import { ChatPlayground } from "@/components/chat/chat-playground";
import { Metadata } from "next";
export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return <ChatPlayground />;
}
