function LucideArrowUpRight() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="lucide/arrow-up-right">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="lucide/arrow-up-right">
          <path d="M7 7H17M17 7V17M17 7L7 17" id="Vector" stroke="var(--stroke-0, #FAE7D8)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function ActionPlanTitle() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full" data-name="Container">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.3] not-italic relative shrink-0 text-[24px] text-nowrap text-white tracking-[-0.72px]">Your Action Plan</p>
      <LucideArrowUpRight />
    </div>
  );
}

interface ActionPlanContentProps {
  actionPlanDate: string | null;
}

function ActionPlanContent({ actionPlanDate }: ActionPlanContentProps) {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Container">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.75)]">
        Your action plan has been updated to reflect the info in your questionnaire and metrics, including lifestyle, supplement, and testing recommendations.
      </p>
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] min-w-full not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.7)] w-[min-content]">
        {actionPlanDate ? `Access your latest plan from ${new Date(actionPlanDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No action plan available yet"}
      </p>
    </div>
  );
}

interface ActionPlanCardProps {
  isLoading: boolean;
  actionPlanDate: string | null;
}

export function ActionPlanCard({ isLoading, actionPlanDate }: ActionPlanCardProps) {
  return (
    <div className="backdrop-blur-md backdrop-filter basis-0 bg-[rgba(253,245,241,0.14)] grow min-h-px min-w-px relative rounded-[12px] self-stretch shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[rgba(253,245,241,0.25)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <div className="content-stretch flex flex-col gap-[16px] items-start p-[24px] relative w-full">
        {isLoading ? (
          <>
            <div className="w-full flex items-start justify-between">
              <div className="h-8 w-48 bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
              <div className="size-6 bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
            </div>
            <div className="w-full flex flex-col gap-4">
              <div className="h-6 w-full bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
            </div>
          </>
        ) : (
          <>
            <ActionPlanTitle />
            <ActionPlanContent actionPlanDate={actionPlanDate} />
          </>
        )}
      </div>
    </div>
  );
}
