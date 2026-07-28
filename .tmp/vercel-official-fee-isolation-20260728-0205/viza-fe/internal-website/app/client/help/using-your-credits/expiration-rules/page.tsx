import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Expiration Rules | Help Center",
};

export default function ExpirationRulesPage() {
  return (
    <HelpArticle
      title="Expiration rules"
      subtitle="Learn when credits expire and how to make the most of them."
      sections={[
        {
          heading: "Standard credit expiration",
          content: [
            {
              type: "paragraph",
              text: "Credits issued through referrals and standard promotions are valid for 12 months from the date they are issued. After 12 months, unused credits expire and cannot be recovered.",
            },
            {
              type: "tip",
              text: "You can check the issue date of your credits in the Billing section of Settings.",
            },
          ],
        },
        {
          heading: "Referral credits",
          content: [
            {
              type: "paragraph",
              text: "Credits earned from successful referrals follow the same 12-month expiration rule. Your ₱9,999 referral reward becomes available within 24 hours of your friend completing their first purchase.",
            },
            {
              type: "list",
              items: [
                "Referral credits are added automatically — no action needed.",
                "Credits are valid for 12 months from the date they are credited.",
                "Both the referrer and the referred friend receive ₱9,999 each.",
              ],
            },
          ],
        },
        {
          heading: "Promotional credits",
          content: [
            {
              type: "paragraph",
              text: "Credits issued as part of a special promotion may have different expiration terms. The specific expiry date for promotional credits will be noted in the promotion details or in your notification at the time of issue.",
            },
          ],
        },
        {
          heading: "What happens when credits expire",
          content: [
            {
              type: "paragraph",
              text: "Expired credits are removed from your balance automatically and cannot be reinstated. If you believe credits were incorrectly expired, contact our support team through the Concierge tab.",
            },
          ],
        },
      ]}
    />
  );
}
