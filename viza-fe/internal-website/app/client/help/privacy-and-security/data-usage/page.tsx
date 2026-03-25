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
                "Personal data: lab results, profile_data, questionnaire responses, and visa history.",
                "Usage data: pages visited, features used, and session activity to improve the platform.",
                "Commerce data: order history and payment records for purchases made through our commerce providers.",
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
                "To generate personalized personalized insights and reports.",
                "To enable your assigned visa team to review results and provide guidance.",
                "To process purchases and manage service fulfillment.",
                "To send booking reminders and important account notifications.",
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
              text: "Some platform functions rely on trusted third-party providers, such as booking and commerce tools, to complete transactions and appointments.",
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
