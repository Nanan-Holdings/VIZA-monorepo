import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Credits Troubleshooting | Help Center",
};

export default function CreditsTroubleshootingPage() {
  return (
    <HelpArticle
      title="Troubleshooting credits"
      subtitle="Resolve common issues with credits not showing or applying correctly."
      sections={[
        {
          heading: "Credits not showing in my balance",
          content: [
            {
              type: "paragraph",
              text: "If you earned credits through a referral or promotion but they don't appear in your balance, try the following:",
            },
            {
              type: "list",
              items: [
                "Wait up to 24 hours — referral credits are credited within 24 hours of a friend's first purchase.",
                "Refresh the app or log out and back in to trigger a balance update.",
                "Check that the referral was made using your unique link from the Refer Your Friends page.",
                "Confirm your friend completed a qualifying purchase (new members only, one per new member).",
              ],
            },
            {
              type: "tip",
              text: "Credits appear in the Billing section of Settings and at checkout. If they still don't appear after 24 hours, contact support.",
            },
          ],
        },
        {
          heading: "Credits not applying at checkout",
          content: [
            {
              type: "list",
              items: [
                "Make sure 'Apply credits' is toggled on during checkout.",
                "Check that your credits haven't expired — credits are valid for 12 months.",
                "Confirm the service is eligible for credit use (see Where Credits Apply).",
                "Try refreshing the checkout page and applying credits again.",
              ],
            },
          ],
        },
        {
          heading: "Incorrect credit amount",
          content: [
            {
              type: "paragraph",
              text: "If the credit amount shown at checkout doesn't match what you expect, check your balance in the Billing section of Settings. Some credits may have expired, or a recent transaction may have already reduced your balance.",
            },
          ],
        },
        {
          heading: "Still having issues?",
          content: [
            {
              type: "paragraph",
              text: "Contact our support team through the Concierge tab for real-time assistance. Have your account email and a description of the issue ready so we can resolve it quickly.",
            },
          ],
        },
      ]}
    />
  );
}
