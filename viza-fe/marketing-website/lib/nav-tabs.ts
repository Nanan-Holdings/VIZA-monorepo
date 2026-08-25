/**
 * Center nav tabs, shared by the explore page's inline nav and `SiteNav` so the
 * two never drift.
 *
 * `labelKey` resolves in the `nav` message namespace. Every href must be a route
 * that actually renders — a tab pointing at a missing page shows visitors an
 * error, which is what happened to the old "活动" tab.
 */
export interface NavTab {
  id: "explore" | "product" | "about" | "events";
  href: string;
  labelKey: string;
}

export const NAV_TABS: NavTab[] = [
  { id: "explore", href: "/", labelKey: "nav.explore" },
  { id: "product", href: "/product", labelKey: "nav.product" },
  { id: "about", href: "/about", labelKey: "nav.about" },
  { id: "events", href: "/events", labelKey: "nav.events" },
];
