import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Where Credits Apply | Help Center",
};

export default function WhereCreditsApplyPage() {
  return (
    <HelpArticle
      title="Where credits apply"
      subtitle="Understand where and how your credits can be used."
      sections={[
        {
          heading: "What are credits?",
          content: [
            {
              type: "paragraph",
              text: "Credits are a form of account balance that can be earned through referrals and promotions. They reduce the amount you pay out-of-pocket when booking services.",
            },
          ],
        },
        {
          heading: "Services where credits apply",
          content: [
            {
              type: "list",
              items: [
                "Blood panel bookings on the Services tab.",
                "Supplement purchases in the Supplement Marketplace.",
                "Any service listed on the VIZA Services page.",
              ],
            },
            {
              type: "tip",
              text: "Your available credit balance is shown at checkout before you confirm a purchase.",
            },
          ],
        },
        {
          heading: "How to apply credits at checkout",
          content: [
            {
              type: "list",
              items: [
                "Select a service or product and proceed to checkout.",
                "On the payment screen, your credit balance will be displayed.",
                "Toggle 'Apply credits' to use your balance towards the total.",
                "The remaining balance (if any) will be charged to your payment method.",
              ],
            },
          ],
        },
        {
          heading: "Where credits cannot be used",
          content: [
            {
              type: "list",
              items: [
                "Credits cannot be transferred to another account.",
                "Credits cannot be redeemed for cash.",
                "Credits cannot be used on services outside the VIZA platform.",
              ],
            },
          ],
        },
      ]}
    />
  );
}
