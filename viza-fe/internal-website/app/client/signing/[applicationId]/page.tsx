"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { BrandActionButton } from "@/components/client/brand-action-button";
import {
  SignaturePad,
  DeclarationPreview,
  type DeclarationItem,
} from "@/components/client/signing";
import {
  getSigningContext,
  submitSignature,
  type SigningContext,
} from "@/app/actions/submit-signature";

// AU declaration field keys + labelKeys mirrored from
// viza-fe/internal-website/components/client/wizards/au/config.ts. Kept inline
// here so the signing page doesn't import the wizard's React subtree.
const AU_HEALTH: Array<{ key: string; labelKey: string }> = [
  { key: "decl_health_lived_outside_passport_country", labelKey: "declarations.healthLivedOutsidePassport" },
  { key: "decl_health_visited_health_facility", labelKey: "declarations.healthVisitedFacility" },
  { key: "decl_health_healthcare_worker", labelKey: "declarations.healthHealthcareWorker" },
  { key: "decl_health_aged_or_childcare", labelKey: "declarations.healthAgedOrChildcare" },
  { key: "decl_health_classroom_3plus_months", labelKey: "declarations.healthClassroom3Months" },
  { key: "decl_health_tb_or_chest_xray", labelKey: "declarations.healthTbOrChestXray" },
  { key: "has_health_insurance", labelKey: "declarations.hasHealthInsurance" },
];

const AU_CHARACTER: Array<{ key: string; labelKey: string }> = [
  { key: "decl_char_criminal_convictions", labelKey: "declarations.charCriminalConvictions" },
  { key: "decl_char_war_crimes", labelKey: "declarations.charWarCrimes" },
  { key: "decl_char_sexual_offence", labelKey: "declarations.charSexualOffence" },
  { key: "decl_char_terrorism", labelKey: "declarations.charTerrorism" },
  { key: "decl_char_people_smuggling", labelKey: "declarations.charPeopleSmuggling" },
  { key: "decl_char_military_training", labelKey: "declarations.charMilitaryTraining" },
  { key: "decl_char_visa_refused", labelKey: "declarations.charVisaRefused" },
];

const AU_FINAL: Array<{ key: string; labelKey: string }> = [
  { key: "decl_information_correct", labelKey: "declarations.informationCorrect" },
  { key: "decl_understands_visa_does_not_guarantee_entry", labelKey: "declarations.understandsNoEntryGuarantee" },
  { key: "decl_aware_of_data_processing", labelKey: "declarations.awareDataProcessing" },
  { key: "decl_will_leave_before_visa_expires", labelKey: "declarations.willLeaveBeforeExpiry" },
  { key: "decl_genuine_visitor", labelKey: "declarations.genuineVisitor" },
];

function buildItems(
  defs: Array<{ key: string; labelKey: string }>,
  answers: Record<string, string>,
  t: (key: string) => string,
): DeclarationItem[] {
  return defs.map(({ key, labelKey }) => ({
    key,
    question: t(labelKey),
    answer: answers[key] ?? "",
  }));
}

export default function SigningPage() {
  const params = useParams<{ applicationId: string }>();
  const applicationId = params?.applicationId ?? "";
  const router = useRouter();
  const tAu = useTranslations("simplifiedForm.au");
  const t = useTranslations("client.signing");

  const [state, setState] = React.useState<
    | { stage: "loading" }
    | { stage: "error"; message: string }
    | { stage: "ready"; context: SigningContext }
    | { stage: "submitting"; context: SigningContext }
    | { stage: "submitted"; context: SigningContext }
  >({ stage: "loading" });
  const [blob, setBlob] = React.useState<Blob | null>(null);

  React.useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    (async () => {
      const res = await getSigningContext(applicationId);
      if (cancelled) return;
      if (!res.ok) {
        setState({ stage: "error", message: res.error });
        return;
      }
      if (!res.context.isAuVisitor600) {
        setState({
          stage: "error",
          message: t("notAuApplication"),
        });
        return;
      }
      setState({ stage: "ready", context: res.context });
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId, t]);

  const onSubmit = async () => {
    if (state.stage !== "ready" || !blob) return;
    setState({ stage: "submitting", context: state.context });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const res = await submitSignature(state.context.applicationId, bytes);
    if (res.ok) {
      setState({ stage: "submitted", context: { ...state.context, alreadySigned: true } });
    } else {
      setState({ stage: "error", message: res.error });
    }
  };

  if (state.stage === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        <p className="text-lg text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (state.stage === "error") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Empty className="max-w-lg">
          <EmptyHeader className="max-w-lg">
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle>{t("errorTitle")}</EmptyTitle>
            <EmptyDescription>{state.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (state.context.alreadySigned && state.stage !== "submitted") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Empty className="max-w-lg">
          <EmptyHeader className="max-w-lg">
            <EmptyMedia variant="icon">
              <CheckCircle2 className="text-brand-500" />
            </EmptyMedia>
            <EmptyTitle>{t("alreadySignedTitle")}</EmptyTitle>
            <EmptyDescription>{t("alreadySignedBody")}</EmptyDescription>
          </EmptyHeader>
          <BrandActionButton onClick={() => router.push("/client/home")}>
            {t("backToHome")}
          </BrandActionButton>
        </Empty>
      </div>
    );
  }

  if (state.stage === "submitted") {
    return (
      <motion.div
        className="flex items-center justify-center min-h-[60vh]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Empty className="max-w-lg">
          <EmptyHeader className="max-w-lg">
            <EmptyMedia variant="icon">
              <CheckCircle2 className="text-brand-500" />
            </EmptyMedia>
            <EmptyTitle>{t("submittedTitle")}</EmptyTitle>
            <EmptyDescription>{t("submittedBody")}</EmptyDescription>
          </EmptyHeader>
          <BrandActionButton onClick={() => router.push("/client/home")}>
            {t("backToHome")}
          </BrandActionButton>
        </Empty>
      </motion.div>
    );
  }

  const ctx = state.context;
  const health = buildItems(AU_HEALTH, ctx.declarationAnswers, tAu);
  const character = buildItems(AU_CHARACTER, ctx.declarationAnswers, tAu);
  const finalItems = buildItems(AU_FINAL, ctx.declarationAnswers, tAu);

  return (
    <motion.div
      className="w-full max-w-[820px] mx-auto py-8 space-y-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="space-y-2">
        <h1 className="font-heading font-medium text-[28px] xl:text-[30px] text-foreground tracking-[-0.9px]">
          {t("pageTitle")}
        </h1>
        <p className="text-[15px] text-muted-foreground leading-relaxed">{t("pageSubtitle")}</p>
      </header>

      <DeclarationPreview
        health={health}
        character={character}
        final={finalItems}
        healthHeading={t("healthHeading")}
        characterHeading={t("characterHeading")}
        finalHeading={t("finalHeading")}
        yesLabel={t("yes")}
        noLabel={t("no")}
        unanswered={t("unanswered")}
      />

      <section className="space-y-3">
        <h2 className="font-heading font-medium text-[20px] text-foreground tracking-[-0.6px]">
          {t("signHeading")}
        </h2>
        <p className="text-[14px] text-muted-foreground">{t("signSubtitle")}</p>
        <SignaturePad
          onChange={setBlob}
          ariaLabel={t("padAriaLabel")}
          clearLabel={t("clear")}
          disabled={state.stage === "submitting"}
        />
      </section>

      <div className="flex justify-end">
        <BrandActionButton
          onClick={onSubmit}
          disabled={!blob}
          loading={state.stage === "submitting"}
          loadingText={t("submitting")}
        >
          {t("submit")}
        </BrandActionButton>
      </div>
    </motion.div>
  );
}
