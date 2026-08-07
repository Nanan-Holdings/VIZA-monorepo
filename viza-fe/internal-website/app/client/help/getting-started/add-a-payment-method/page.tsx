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
              text: "VIZA uses secure checkout for eligible application, subscription, and agency-fee payments. Available payment methods are shown before you confirm a purchase.",
            },
          ],
        },
        {
          heading: "Setting up your payment method",
          content: [
            {
              type: "list",
              items: [
                "Open the application or subscription checkout you want to pay.",
                "Review the amount, currency, and payment description.",
                "Choose one of the payment methods offered at checkout and complete the provider's secure flow.",
              ],
            },
            {
              type: "tip",
              text: "VIZA does not ask you to send full card details through chat or email. Contact Support if a checkout does not show the payment method you expect.",
            },
          ],
        },
        {
          heading: "Using points",
          content: [
            {
              type: "paragraph",
              text: "Eligible VIZA Points and their redemption options are shown in Points Center. Availability and limits can vary by plan, promotion, and purchase type.",
            },
          ],
        },
        {
          heading: "Viewing past transactions",
          content: [
            {
              type: "paragraph",
              text: "Open Billing to view payment history, receipts, invoice requests, and refund status.",
            },
          ],
        },
      ]}
    />
  );
}
