import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Two-Factor Support | Help Center",
};

export default function TwoFactorSupportPage() {
  return (
    <HelpArticle
      title="Two-factor support"
      subtitle="Add an extra layer of protection to your account."
      sections={[
        {
          heading: "What is two-factor authentication",
          content: [
            {
              type: "paragraph",
              text: "Two-factor authentication (2FA) adds a second verification step during sign-in. This helps protect your account even if your password is compromised.",
            },
          ],
        },
        {
          heading: "How to enable 2FA",
          content: [
            {
              type: "paragraph",
              text: "2FA support is currently enabled with assistance from our team.",
            },
            {
              type: "list",
              items: [
                "Open Concierge and contact support.",
                "Request two-factor authentication for your account.",
                "Follow the setup instructions sent by support.",
              ],
            },
          ],
        },
        {
          heading: "If you lose access to your second factor",
          content: [
            {
              type: "paragraph",
              text: "If you can no longer access your second factor, contact support immediately. Our team will verify your identity and help restore access.",
            },
          ],
        },
        {
          heading: "Need help",
          content: [
            {
              type: "tip",
              text: "Use Concierge for the fastest response on account security requests.",
            },
          ],
        },
      ]}
    />
  );
}
