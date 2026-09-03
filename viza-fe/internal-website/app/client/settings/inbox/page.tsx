import type { Metadata } from "next";
import { InboxContent } from "./inbox-content";

export const metadata: Metadata = {
  title: "Inbox | VIZA",
  description:
    "Mail received at your VIZA address — official letters, read and organised for you.",
};

export default function SettingsInboxPage() {
  return <InboxContent />;
}
