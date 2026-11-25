import SiteHeader, { type HeaderTab } from "@/design-system/sections/SiteHeader";

type Tab = "explore" | "events" | "arrivalCards" | "guides" | "blog" | "about" | "contact";

const TAB_MAP: Record<Tab, HeaderTab | undefined> = {
  explore: "destinations",
  events: undefined,
  arrivalCards: "arrivalCards",
  guides: "guides",
  blog: "news",
  about: "about",
  contact: "contact",
};

/**
 * Kept for the pages that import SiteNav: renders the design-system header
 * (design-system/sections/SiteHeader.tsx) with the matching tab marked.
 */
export default function SiteNav({ activeTab }: { activeTab?: Tab }) {
  return <SiteHeader active={activeTab ? TAB_MAP[activeTab] : undefined} />;
}
