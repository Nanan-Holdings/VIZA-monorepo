import { getTranslations } from "next-intl/server";
import { CircleNotch as Loader2 } from "@phosphor-icons/react/dist/ssr";

/** Shown while the guide's server data loads, right after the applicant clicks. */
export default async function FrNextStepsLoading() {
  const t = await getTranslations("franceAppointment.nextStepsGuide");
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" role="status">
      <Loader2 className="h-12 w-12 animate-spin text-brand-500" aria-hidden="true" />
      <p className="text-lg text-muted-foreground">{t("loading")}</p>
    </div>
  );
}
