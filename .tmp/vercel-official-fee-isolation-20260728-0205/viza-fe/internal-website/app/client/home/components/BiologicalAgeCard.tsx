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

function BiologicalAgeTitle() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full" data-name="Container">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.3] not-italic relative shrink-0 text-[24px] text-nowrap text-white tracking-[-0.72px]">Biological age</p>
      <LucideArrowUpRight />
    </div>
  );
}

interface BiologicalAgeContentProps {
  biologicalAge: number | null;
  chronologicalAge: number | null;
  phenoAgeAccel: number | null;
}

function BiologicalAgeContent({ biologicalAge, chronologicalAge, phenoAgeAccel }: BiologicalAgeContentProps) {
  const getAgeMessage = (accel: number | null) => {
    if (accel === null) {
      return "Calculating...";
    }
    
    if (accel < -5) {
      return "Much younger than your actual age";
    } else if (accel < 0) {
      return `${Math.abs(accel).toFixed(1)} younger than your actual age`;
    } else if (accel > 5) {
      return "Older than your actual age";
    } else if (accel > 0) {
      return `${accel.toFixed(1)} years older than your actual age`;
    } else {
      return "Same as your actual age";
    }
  };

  return (
    <div className="content-stretch flex flex-col items-start not-italic relative shrink-0 w-full" data-name="Container">
      <p className="font-['Poppins:Regular',sans-serif] leading-[1.3] relative shrink-0 text-[#fdf5f1] text-[0px] text-nowrap tracking-[-0.84px]">
        <span className="font-['Sofia_Pro:Regular',sans-serif] text-[56px]">{biologicalAge?.toFixed(1) ?? '--'}</span>
        <span className="font-['Sofia_Pro:Regular',sans-serif] text-[16px] text-[rgba(253,245,241,0.55)] tracking-[-0.48px]">/</span>
        <span className="font-['Sofia_Pro:Medium',sans-serif] text-[16px] text-[rgba(253,245,241,0.55)] tracking-[-0.48px]">{chronologicalAge ?? '--'}</span>
      </p>
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] min-w-full -mt-1 relative shrink-0 text-[16px] text-[rgba(255,255,255,0.7)] w-[min-content]">
        {getAgeMessage(phenoAgeAccel)}
      </p>
    </div>
  );
}

interface BiologicalAgeCardProps {
  isLoading: boolean;
  biologicalAge: number | null;
  chronologicalAge: number | null;
  phenoAgeAccel: number | null;
}

export function BiologicalAgeCard({ isLoading, biologicalAge, chronologicalAge, phenoAgeAccel }: BiologicalAgeCardProps) {
  return (
    <div className="backdrop-blur-md backdrop-filter bg-[rgba(253,245,241,0.14)] content-stretch flex flex-col gap-[16px] items-start p-[24px] relative rounded-[12px] size-full" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[rgba(253,245,241,0.25)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      {isLoading ? (
        <>
          <div className="w-full flex items-start justify-between">
            <div className="h-8 w-40 bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
            <div className="size-6 bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
          </div>
          <div className="w-full flex flex-col gap-4">
            <div className="h-14 w-40 bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
            <div className="h-6 w-full bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
          </div>
        </>
      ) : (
        <>
          <BiologicalAgeTitle />
          <BiologicalAgeContent biologicalAge={biologicalAge} chronologicalAge={chronologicalAge} phenoAgeAccel={phenoAgeAccel} />
        </>
      )}
    </div>
  );
}
