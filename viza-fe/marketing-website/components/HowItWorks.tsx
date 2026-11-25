import { getTranslations } from "next-intl/server";
import { homeSteps, STEP_IMAGES } from "@/lib/site-content";
import SectionHead from "@/design-system/sections/SectionHead";
import StepsAccordion from "@/design-system/sections/StepsAccordion";
import Button from "@/design-system/ui/Button";

/** The four steps with the free-service side card, shared by the home and about pages. */
export default async function HowItWorks() {
  const t = await getTranslations("homePage");
  return (
    <section className="ds-section" id="how-it-works">
      <div className="ds-container ds-stack">
        <SectionHead title={t("steps.title")} action={<Button href="/apply">{t("steps.cta")}</Button>} />
        <StepsAccordion
          steps={homeSteps(t).map((s, i) => ({ ...s, image: STEP_IMAGES[i] }))}
          side={
            <>
              <div className="ds-side-stats">
                <div>
                  <p className="ds-statement">{t("steps.side.freeValue")}</p>
                  <p className="ds-small ds-strong">{t("steps.side.freeLabel")}</p>
                </div>
                <div>
                  <p className="ds-statement">{t("steps.side.langValue")}</p>
                  <p className="ds-small ds-strong">{t("steps.side.langLabel")}</p>
                </div>
              </div>
              <hr className="ds-rule" />
              <div className="ds-side-note">
                <p className="ds-lead">{t("steps.side.note")}</p>
                <p className="ds-body">{t("steps.side.noteBody")}</p>
              </div>
            </>
          }
        />
      </div>
    </section>
  );
}
