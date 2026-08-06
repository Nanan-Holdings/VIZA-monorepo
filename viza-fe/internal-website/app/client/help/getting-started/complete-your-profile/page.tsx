import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Complete Your Profile | Help Center",
};

export default function CompleteYourProfilePage() {
  return (
    <HelpArticle
      title="Complete your profile"
      subtitle="Keep reusable applicant information accurate across your visa applications."
      sections={[
        {
          heading: "Why your profile matters",
          content: [
            {
              type: "paragraph",
              text: "Your Universal Information profile stores applicant details that can be reused across visa applications. Keeping it accurate reduces duplicate entry and helps prevent inconsistencies in official forms.",
            },
          ],
        },
        {
          heading: "How to update your profile",
          content: [
            {
              type: "list",
              items: [
                "Open Settings from the navigation menu.",
                "Select Open Universal Information.",
                "Review your identity, contact, passport, travel, and background details.",
                "Save each section after making changes.",
              ],
            },
            {
              type: "tip",
              text: "Enter names, dates, and passport details exactly as they appear on your travel documents.",
            },
          ],
        },
        {
          heading: "What information is collected",
          content: [
            {
              type: "list",
              items: [
                "Identity information, including your legal name, birth details, nationality, and gender.",
                "Contact information, including your email, phone number, and current address.",
                "Passport details and reusable supporting documents.",
                "Travel, family, education, employment, and background details used by visa forms.",
              ],
            },
          ],
        },
        {
          heading: "Updating your email or password",
          content: [
            {
              type: "paragraph",
              text: "Email and password changes are handled in the Security section of Settings. Go to Settings → Security and follow the prompts to update your login credentials.",
            },
          ],
        },
      ]}
    />
  );
}
