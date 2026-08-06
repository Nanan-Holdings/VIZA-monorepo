import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Data Usage | Help Center",
};

export default function DataUsagePage() {
  return (
    <HelpArticle
      title="Data usage"
      subtitle="Learn what data we collect and how it is used."
      sections={[
        {
          heading: "What data we collect",
          content: [
            {
              type: "list",
              items: [
                "Personal information: name, date of birth, phone number, and address.",
                "Application data: passport details, visa history, form answers, supporting documents, and consent records.",
                "Usage data: pages visited, features used, and session activity to improve the platform.",
                "Transaction data: payment status, invoices, refunds, and subscription records.",
              ],
            },
          ],
        },
        {
          heading: "How your data is used",
          content: [
            {
              type: "list",
              items: [
                "To prepare, review, and manage your visa applications.",
                "To let authorized visa staff review application materials and provide support.",
                "To process payments and track application service fulfillment.",
                "To send application, document, payment, and status notifications.",
              ],
            },
            {
              type: "tip",
              text: "Your personal data is handled with strict confidentiality and is not sold to third parties.",
            },
          ],
        },
        {
          heading: "Third-party services",
          content: [
            {
              type: "paragraph",
              text: "Some platform functions rely on trusted third-party providers for payments, document processing, communications, and official application submission.",
            },
            {
              type: "paragraph",
              text: "Only the minimum necessary information is shared with these providers to fulfill services on your behalf.",
            },
          ],
        },
        {
          heading: "Your data rights",
          content: [
            {
              type: "list",
              items: [
                "Request a copy of your account and personal data by contacting support.",
                "Request correction of inaccurate profile details.",
                "Request account deletion, subject to applicable visa and legal retention requirements.",
              ],
            },
          ],
        },
      ]}
    />
  );
}
