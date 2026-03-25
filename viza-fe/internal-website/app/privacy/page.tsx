import { getTranslations } from "next-intl/server";
import { StaticArticle } from "@/components/client/static-article";

export const metadata = {
  title: "Privacy Policy | VIZA",
};

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <StaticArticle
      title={t("title")}
      subtitle={t("subtitle")}
      sections={[
        {
          heading: t("sections.introduction.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.introduction.p1"),
            },
            {
              type: "paragraph",
              text: t("sections.introduction.p2"),
            },
          ],
        },
        {
          heading: t("sections.collect.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.collect.intro"),
            },
            {
              type: "list",
              items: [
                t("sections.collect.item1"),
                t("sections.collect.item2"),
                t("sections.collect.item3"),
                t("sections.collect.item4"),
                t("sections.collect.item5"),
              ],
            },
          ],
        },
        {
          heading: t("sections.use.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.use.intro"),
            },
            {
              type: "list",
              items: [
                t("sections.use.item1"),
                t("sections.use.item2"),
                t("sections.use.item3"),
                t("sections.use.item4"),
                t("sections.use.item5"),
              ],
            },
            {
              type: "tip",
              text: t("sections.use.noSell"),
            },
          ],
        },
        {
          heading: t("sections.sharing.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.sharing.intro"),
            },
            {
              type: "list",
              items: [
                t("sections.sharing.item1"),
                t("sections.sharing.item2"),
                t("sections.sharing.item3"),
                t("sections.sharing.item4"),
                t("sections.sharing.item5"),
              ],
            },
          ],
        },
        {
          heading: t("sections.security.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.security.p1"),
            },
            {
              type: "paragraph",
              text: t("sections.security.p2"),
            },
          ],
        },
        {
          heading: t("sections.rights.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.rights.intro"),
            },
            {
              type: "list",
              items: [
                t("sections.rights.access"),
                t("sections.rights.correction"),
                t("sections.rights.deletion"),
                t("sections.rights.portability"),
                t("sections.rights.withdrawal"),
              ],
            },
          ],
        },
        {
          heading: t("sections.retention.title"),
          content: [
            {
              type: "paragraph",
              text: t("sections.retention.p1"),
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
