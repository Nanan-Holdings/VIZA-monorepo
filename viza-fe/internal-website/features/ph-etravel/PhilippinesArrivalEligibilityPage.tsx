"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Plane, Ship, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  evaluatePhEtravelEligibility,
  PH_ETRAVEL_BOUNDARY_COPY,
  PH_ETRAVEL_FAMILY_MEMBER_COPY,
  PH_ETRAVEL_FORM_URL,
  PH_ETRAVEL_SEA_REVIEW_COPY,
  type PhEtravelEligibilityChoice,
} from "./eligibility";

const OPTIONS: Array<{
  value: PhEtravelEligibilityChoice;
  labelEn: string;
  labelZh: string;
  descriptionEn: string;
  descriptionZh: string;
}> = [
  {
    value: "ordinary_air_passenger",
    labelEn: "Ordinary air passenger",
    labelZh: "普通航空旅客",
    descriptionEn: "Arriving in the Philippines by flight as a regular passenger.",
    descriptionZh: "以普通旅客身份乘飞机抵达菲律宾。",
  },
  {
    value: "ordinary_sea_passenger",
    labelEn: "Ordinary sea passenger",
    labelZh: "普通海路旅客",
    descriptionEn: "Arriving by non-cruise vessel as a regular passenger.",
    descriptionZh: "以普通旅客身份乘非邮轮船只抵达菲律宾。",
  },
  {
    value: "crew",
    labelEn: "Flight or vessel crew",
    labelZh: "机组或船员",
    descriptionEn: "Crew member arriving for duty or operation.",
    descriptionZh: "以工作或运营身份抵达的机组/船员。",
  },
  {
    value: "cruise",
    labelEn: "Cruise traveller",
    labelZh: "邮轮旅客",
    descriptionEn: "Cruise passenger or cruise crew declaration.",
    descriptionZh: "邮轮旅客或邮轮工作人员申报。",
  },
  {
    value: "special_registration",
    labelEn: "Special registration",
    labelZh: "特殊登记",
    descriptionEn: "Official eTravel special registration path.",
    descriptionZh: "菲律宾官方 eTravel 特殊登记路径。",
  },
  {
    value: "foreign_diplomat_or_dignitary",
    labelEn: "Foreign diplomat or dignitary",
    labelZh: "外国外交官或政要",
    descriptionEn: "Foreign diplomats, dependents, dignitaries, or delegations.",
    descriptionZh: "外国外交官及家属、外国政要或随行团。",
  },
  {
    value: "nine_e_visa",
    labelEn: "9(e) visa holder",
    labelZh: "9(e) 签证持有人",
    descriptionEn: "Holder of a Philippine 9(e) visa.",
    descriptionZh: "菲律宾 9(e) 签证持有人。",
  },
  {
    value: "diplomatic_official_service_passport",
    labelEn: "Diplomatic, official, or service passport",
    labelZh: "外交、公务或因公护照",
    descriptionEn: "Travelling on a diplomatic, official, or service passport.",
    descriptionZh: "持外交、公务或因公护照旅行。",
  },
];

export function PhilippinesArrivalEligibilityPage() {
  const [choice, setChoice] = useState<PhEtravelEligibilityChoice>("ordinary_air_passenger");
  const result = useMemo(() => evaluatePhEtravelEligibility(choice), [choice]);

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 text-[#102033] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1090px] gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e6fb] bg-white px-3 py-1 text-sm font-medium text-[#03346E]">
              <ShieldCheck className="h-4 w-4" />
              Philippines eTravel Arrival
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-[#0b2545] sm:text-4xl">
              菲律宾 eTravel 入境申报
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[#47617f]">
              Confirm the traveller type before opening the form. This keeps ordinary passenger declarations separate
              from official exceptions and special eTravel paths.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {OPTIONS.map((option) => {
              const selected = choice === option.value;
              const Icon = option.value.includes("sea") || option.value === "cruise" ? Ship : Plane;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setChoice(option.value)}
                  className={[
                    "min-h-[118px] rounded-lg border bg-white p-4 text-left transition",
                    selected ? "border-[#03346E] shadow-[0_10px_28px_rgba(3,52,110,0.12)]" : "border-[#e3eaf3] hover:border-[#9db5d2]",
                  ].join(" ")}
                  aria-pressed={selected}
                >
                  <div className="flex items-start gap-3">
                    <span className={selected ? "text-[#03346E]" : "text-[#74869b]"}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#102033]">{option.labelZh}</span>
                      <span className="mt-0.5 block text-xs font-medium text-[#47617f]">{option.labelEn}</span>
                      <span className="mt-2 block text-sm leading-5 text-[#5d7188]">
                        {option.descriptionZh}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-[#d7e6fb] bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              {result.status === "supported" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div>
                <h2 className="text-base font-semibold text-[#0b2545]">{result.titleZh}</h2>
                <p className="mt-1 text-sm font-medium text-[#47617f]">{result.titleEn}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#3d5878]">{result.messageZh}</p>
            <p className="mt-2 text-sm leading-6 text-[#5d7188]">{result.messageEn}</p>

            {choice === "ordinary_sea_passenger" ? (
              <div className="mt-4 space-y-2 rounded-md border border-[#d7e6fb] bg-[#f7fbff] p-3 text-xs leading-5 text-[#315171]">
                <p>{PH_ETRAVEL_SEA_REVIEW_COPY.ordinaryPassengerZh}</p>
                <p>{PH_ETRAVEL_SEA_REVIEW_COPY.destinationZh}</p>
                <p>{PH_ETRAVEL_SEA_REVIEW_COPY.customsZh}</p>
                <p className="text-[#47617f]">{PH_ETRAVEL_SEA_REVIEW_COPY.signatureZh}</p>
                <p className="text-[#47617f]">{PH_ETRAVEL_SEA_REVIEW_COPY.crewCruiseZh}</p>
              </div>
            ) : null}

            {result.status === "supported" ? (
              <Button asChild className="mt-5 w-full">
                <Link href={PH_ETRAVEL_FORM_URL}>开始填写 / Start form</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="mt-5 w-full bg-white">
                <a href="https://etravel.gov.ph" target="_blank" rel="noopener noreferrer">
                  打开官方 eTravel
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="space-y-3 text-sm leading-6 text-amber-950">
                <div>
                  <p>{PH_ETRAVEL_BOUNDARY_COPY.freeZh}</p>
                  <p className="text-xs leading-5 text-amber-900">{PH_ETRAVEL_BOUNDARY_COPY.freeEn}</p>
                </div>
                <div>
                  <p>{PH_ETRAVEL_BOUNDARY_COPY.notVisaZh}</p>
                  <p className="text-xs leading-5 text-amber-900">{PH_ETRAVEL_BOUNDARY_COPY.notVisaEn}</p>
                </div>
                <div>
                  <p>{PH_ETRAVEL_BOUNDARY_COPY.borderZh}</p>
                  <p className="text-xs leading-5 text-amber-900">{PH_ETRAVEL_BOUNDARY_COPY.borderEn}</p>
                </div>
                <div>
                  <p>{PH_ETRAVEL_FAMILY_MEMBER_COPY.zh}</p>
                  <p className="text-xs leading-5 text-amber-900">{PH_ETRAVEL_FAMILY_MEMBER_COPY.en}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
