import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Explore Services | Help Center",
};

export default function ExploreServicesPage() {
  return (
    <HelpArticle
      title="Explore services"
      subtitle="Discover what's available on the VIZA platform."
      sections={[
        {
          heading: "The Services tab",
          content: [
            {
              type: "paragraph",
              text: "The Services tab is your gateway to everything available on the platform. Open it from the main navigation bar at the top of the screen to browse and book.",
            },
          ],
        },
        {
          heading: "Blood panel bookings",
          content: [
            {
              type: "paragraph",
              text: "Choose from a range of blood panels designed to give you a comprehensive picture of your profile. Each panel is curated for specific goals — from general wellness to longevity optimization.",
            },
            {
              type: "list",
              items: [
                "Browse available panels in the Services tab.",
                "Select a panel to view what metrics are included.",
                "Tap Book to choose a date and time for your blood draw.",
                "Track your upcoming and past bookings in the Scheduled and History tabs.",
              ],
            },
          ],
        },
        {
          heading: "Supplement Marketplace",
          content: [
            {
              type: "paragraph",
              text: "Access insider prices on 300+ curated longevity products. The Supplement Marketplace surfaces products that are relevant to your personal data and goals.",
            },
            {
              type: "tip",
              text: "Credits earned through referrals can be used to purchase supplements at checkout.",
            },
          ],
        },
        {
          heading: "Service Marketplace",
          content: [
            {
              type: "paragraph",
              text: "Access to curated service_requests — including documents and peptides — managed by your assigned visa team. Services require a consultation before they can be issued.",
            },
          ],
        },
        {
          heading: "Coming soon",
          content: [
            {
              type: "paragraph",
              text: "The platform is continuously growing. New services are added regularly, including at-home testing kits, specialist referrals, and more. Check the Services tab for the latest additions.",
            },
          ],
        },
      ]}
    />
  );
}
