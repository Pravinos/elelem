import { ChatMessage } from "@/lib/api";

export type DisplayMessage = ChatMessage & {
  id: string;
  createdAt: string;
};
