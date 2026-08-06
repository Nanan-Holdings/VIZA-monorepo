import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Explore VIZA | Help Center",
};

export default function ExploreServicesPage() {
  return (
    <HelpArticle
      title="Explore VIZA"
      subtitle="Discover the tools available throughout your visa journey."
      sections={[
        {
          heading: "Visa applications",
          content: [
            {
              type: "paragraph",
              text: "Start or continue an application from Home or Application. VIZA keeps your application answers, supporting documents, payments, consent, and status in one workflow.",
            },
          ],
        },
        {
          heading: "Universal Information",
          content: [
            {
              type: "paragraph",
              text: "Save reusable personal, passport, contact, travel, and background information once, then reuse it across supported visa applications.",
            },
            {
              type: "list",
              items: [
                "Open Universal Information from Settings.",
                "Review each category and upload reusable documents.",
                "Save your changes before returning to an application.",
                "Confirm prefilled answers inside each visa form before submission.",
              ],
            },
          ],
        },
        {
          heading: "VIZA AI",
          content: [
            {
              type: "paragraph",
              text: "Use VIZA AI to understand visa routes, requirements, and next steps. Once your route is clear, continue detailed data entry in the Application area.",
            },
            {
              type: "tip",
              text: "For official requirements, rely on the source links shown by VIZA and ask support when information is uncertain.",
            },
          ],
        },
        {
          heading: "Travel AI",
          content: [
            {
              type: "paragraph",
              text: "Plan trips with Travel AI, including destinations, dates, travelers, preferences, and itinerary ideas. Travel planning stays separate from your official visa application.",
            },
          ],
        },
        {
          heading: "Support and status",
          content: [
            {
              type: "paragraph",
              text: "Use Status to follow application progress and Support for account, payment, document, or timing questions that require the customer-service team.",
            },
          ],
        },
      ]}
    />
  );
}
