import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Account Security Tips | Help Center",
};

export default function AccountSecurityTipsPage() {
  return (
    <HelpArticle
      title="Account security tips"
      subtitle="Best practices to keep your account and personal data safe."
      sections={[
        {
          heading: "Use a strong, unique password",
          content: [
            {
              type: "paragraph",
              text: "Choose a password that is long, unique, and difficult to guess. Avoid reusing passwords from other services.",
            },
            {
              type: "list",
              items: [
                "Use at least 12 characters.",
                "Include uppercase, lowercase, numbers, and symbols.",
                "Store passwords in a trusted password manager if possible.",
              ],
            },
          ],
        },
        {
          heading: "Keep your credentials private",
          content: [
            {
              type: "paragraph",
              text: "Never share your login details. Official support will never ask for your password.",
            },
            {
              type: "tip",
              text: "If you suspect your password was exposed, change it immediately in Settings → Security.",
            },
          ],
        },
        {
          heading: "Use safe login habits",
          content: [
            {
              type: "list",
              items: [
                "Log out after using shared or public devices.",
                "Do not save passwords in public browsers.",
                "Avoid logging in from unknown networks when possible.",
              ],
            },
          ],
        },
        {
          heading: "Watch for suspicious activity",
          content: [
            {
              type: "paragraph",
              text: "If you notice unexpected account changes, failed login alerts, or unfamiliar activity, contact support through Concierge as soon as possible.",
            },
          ],
        },
      ]}
    />
  );
}
