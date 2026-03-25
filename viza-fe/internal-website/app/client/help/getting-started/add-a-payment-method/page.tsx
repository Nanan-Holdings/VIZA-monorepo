import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Add a Payment Method | Help Center",
};

export default function AddPaymentMethodPage() {
  return (
    <HelpArticle
      title="Add a payment method"
      subtitle="Learn how billing and payment work on the platform."
      sections={[
        {
          heading: "How billing works",
          content: [
            {
              type: "paragraph",
              text: "Billing and payment method management are currently handled offline by our support team. This allows us to offer flexible payment arrangements and keep your financial details off digital systems where possible.",
            },
          ],
        },
        {
          heading: "Setting up your payment method",
          content: [
            {
              type: "list",
              items: [
                "Contact our support team via the Concierge tab or by emailing support@viza.com.",
                "Let the team know the payment method you'd like to use (credit card, bank transfer, or GCash).",
                "The team will securely record your details and confirm setup.",
              ],
            },
            {
              type: "tip",
              text: "Once your payment method is set up, you can use credits at checkout to offset the cost of any service.",
            },
          ],
        },
        {
          heading: "Using credits at checkout",
          content: [
            {
              type: "paragraph",
              text: "If you have available credits, they will appear as a payment option at the checkout screen when booking a service. You can choose to apply all or part of your credits to reduce the amount charged to your payment method.",
            },
          ],
        },
        {
          heading: "Viewing past transactions",
          content: [
            {
              type: "paragraph",
              text: "A summary of your billing history is available in the Billing tab under Settings. You can view past transactions and credit usage there.",
            },
          ],
        },
      ]}
    />
  );
}
