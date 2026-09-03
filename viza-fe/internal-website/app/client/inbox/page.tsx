import { redirect } from "next/navigation";

/**
 * The applicant mailbox lives in Settings now (INBOX-008). This route stays
 * for old links (email footers, bookmarks) and simply forwards.
 */
export default function LegacyClientInboxPage() {
  redirect("/client/settings/inbox");
}
