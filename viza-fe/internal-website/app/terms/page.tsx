import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { StaticArticle } from "@/components/client/static-article";
import { zhTermsArticle } from "@/lib/legal/zh-legal-content";

export const metadata = {
  title: "Terms of Service | VIZA",
};

export default async function TermsPage() {
  const locale = await getLocale();
  if (locale.startsWith("zh")) {
    return <StaticArticle {...zhTermsArticle} />;
  }

  const t = await getTranslations("terms");

  return (
    <StaticArticle
      title={t("title")}
      subtitle={t("subtitle")}
      sections={[
        {
          heading: t("sections.acceptance.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.acceptance.p1"),
            },
            {
              type: "paragraph",
              text: t("sections.acceptance.p2"),
            },
          ],
        },
        {
          heading: t("sections.services.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.services.intro"),
            },
            {
              type: "list",
              items: [
                t("sections.services.item1"),
                t("sections.services.item2"),
                t("sections.services.item3"),
                t("sections.services.item4"),
                t("sections.services.item5"),
              ],
            },
            {
              type: "tip",
              text: t("sections.services.disclaimer"),
            },
          ],
        },
        {
          heading: t("sections.eligibility.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.eligibility.intro"),
            },
            {
              type: "list",
              items: [
                t("sections.eligibility.item1"),
                t("sections.eligibility.item2"),
                t("sections.eligibility.item3"),
                t("sections.eligibility.item4"),
              ],
            },
          ],
        },
        {
          heading: t("sections.responsibilities.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.responsibilities.intro"),
            },
            {
              type: "list",
              items: [
                t("sections.responsibilities.item1"),
                t("sections.responsibilities.item2"),
                t("sections.responsibilities.item3"),
                t("sections.responsibilities.item4"),
                t("sections.responsibilities.item5"),
              ],
            },
          ],
        },
        {
          heading: t("sections.visa.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.visa.p1"),
            },
            {
              type: "paragraph",
              text: t("sections.visa.p2"),
            },
          ],
        },
        {
          heading: t("sections.payments.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.payments.p1"),
            },
            {
              type: "list",
              items: [
                t("sections.payments.p2"),
                t("sections.payments.p3"),
                t("sections.payments.p4"),
              ],
            },
          ],
        },
        {
          heading: t("sections.ip.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.ip.p1"),
            },
          ],
        },
        {
          heading: t("sections.liability.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.liability.p1"),
            },
          ],
        },
        {
          heading: t("sections.termination.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.termination.p1"),
            },
            {
              type: "paragraph",
              text: t("sections.termination.p2"),
            },
          ],
        },
        {
          heading: t("sections.changes.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.changes.p1"),
            },
          ],
        },
        {
          heading: t("sections.law.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.law.p1"),
            },
          ],
        },
        {
          heading: t("sections.contact.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.contact.p1"),
            },
          ],
        },
      ]}
    />
  );
}
