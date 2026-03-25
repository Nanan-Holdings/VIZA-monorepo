import { HelpArticle } from "@/components/client/help-article";

export const metadata = {
  title: "Complete Your Profile | Help Center",
};

export default function CompleteYourProfilePage() {
  return (
    <HelpArticle
      title="Complete your profile"
      subtitle="Keep your information accurate so we can personalize your experience."
      sections={[
        {
          heading: "Why your profile matters",
          content: [
            {
              type: "paragraph",
              text: "An accurate profile helps your visa team provide better recommendations and ensures your lab results are interpreted correctly for your age, sex, and personal history.",
            },
          ],
        },
        {
          heading: "How to update your profile",
          content: [
            {
              type: "list",
              items: [
                "Open the app and tap Settings in the navigation menu.",
                "Select the Profile tab at the top of the Settings page.",
                "Fill in your full name, date of birth, phone number, and address.",
                "Tap Save to apply your changes.",
              ],
            },
            {
              type: "tip",
              text: "Your date of birth is used to calculate reference ranges for your lab results. Make sure it is correct before your first blood test.",
            },
          ],
        },
        {
          heading: "What information is collected",
          content: [
            {
              type: "list",
              items: [
                "Full name — used to address you and on visa documents.",
                "Date of birth — used to calibrate lab result reference ranges.",
                "Phone number — used for appointment reminders and urgent notifications.",
                "Address — used for any home-delivery services you order.",
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
