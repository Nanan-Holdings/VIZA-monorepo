"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

const DESTINATION_SKELETON_KEYS = [0, 1, 2, 3, 4, 5];

const DynamicAddDestinationContent = dynamic(
  () =>
    import("./add-destination-content").then(
      (module) => module.AddDestinationContent
    ),
  {
    ssr: false,
    loading: AddDestinationLoading,
  }
);

function AddDestinationLoading() {
  const t = useTranslations("clientStatus.index");
  const homeT = useTranslations("home");
  const loadingLabel = homeT("loadingDashboard");

  return (
    <section
      className="mt-12"
      aria-busy="true"
      aria-label={loadingLabel}
      role="status"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-heading text-[22px] font-medium text-[#26364a]">
          {t("addDestination")}
        </h2>
        <p className="text-[14px] text-[#8a94a6]">{loadingLabel}</p>
      </div>

      <div aria-hidden="true">
        <div className="mb-4 h-[46px] w-full animate-pulse rounded-full bg-[#f3f3f3]" />
        <div className="mb-5 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((key) => (
            <div
              key={key}
              className="h-8 w-20 animate-pulse rounded-full bg-[#f3f3f3]"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DESTINATION_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="h-[170px] animate-pulse rounded-2xl border border-[#efefef] bg-white"
            />
          ))}
        </div>
        <div className="mt-5 h-4 w-64 animate-pulse rounded bg-[#f3f3f3]" />
      </div>
    </section>
  );
}

export function AddDestinationSection({
  startedKeys,
}: {
  startedKeys: string[];
}) {
  return <DynamicAddDestinationContent startedKeys={startedKeys} />;
}
