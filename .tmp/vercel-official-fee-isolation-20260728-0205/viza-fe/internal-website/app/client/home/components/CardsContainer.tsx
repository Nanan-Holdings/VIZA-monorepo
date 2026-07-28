// @ts-nocheck - metric modal removed during domain migration

import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

interface Container9Props {
  isLoading: boolean;
  progressScore: number | null;
  progressScoreCategory: string | null;
  biologicalAge: number | null;
  chronologicalAge: number | null;
  phenoAgeAccel: number | null;
  actionPlanDate: string | null;
  onProgressScoreClick?: () => void;
  onBiologicalAgeClick?: () => void;
}

interface ModalMetric {
  name: string;
  description: string;
  value: number;
  unit: string;
  status: string;
  color: string;
  range?: string;
  referenceRange?: string;
}

function LucideArrowUpRight() {
  return (
    <div className="relative shrink-0 size-[24px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="lucide/arrow-up-right">
          <path d="M7 7H17M17 7V17M17 7L7 17" stroke="var(--stroke-0, #FAE7D8)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function ProgressScoreContainer() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full">
      <p className="font-sofia-pro font-medium leading-[1.3] not-italic relative shrink-0 text-[24px] text-nowrap text-white tracking-[-0.72px]">Progress score</p>
      <LucideArrowUpRight />
    </div>
  );
}

interface ProgressScoreValueProps {
  score: number | null;
  category: string | null;
}

function ProgressScoreValue({ score, category }: ProgressScoreValueProps) {
  const getScoreMessage = (scoreVal: number | null) => {
    if (scoreVal === null) return "Calculating...";
    if (scoreVal >= 81) return "Excellent! You're doing great.";
    if (scoreVal >= 61) return "Very good! Keep improving.";
    if (scoreVal >= 41) return "Good progress. Stick to the plan!";
    if (scoreVal >= 21) return "Fair. Room for improvement.";
    return "Poor. Let's work on this together.";
  };

  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start not-italic relative shrink-0 w-full">
      <p className="font-sofia-pro font-normal leading-[1.3] relative shrink-0 text-[#fdf5f1] text-[0px] text-nowrap tracking-[-0.84px]">
        <span className="font-sofia-pro font-normal text-[56px]">{score ?? '--'}</span>
        <span className="font-sofia-pro font-normal text-[16px] text-[rgba(253,245,241,0.55)] tracking-[-0.48px]">/</span>
        <span className="font-sofia-pro font-medium text-[16px] text-[rgba(253,245,241,0.55)] tracking-[-0.48px]">100</span>
      </p>
      <p className="font-sofia-pro font-medium leading-[1.6] min-w-full relative shrink-0 text-[16px] text-[rgba(255,255,255,0.7)] w-[min-content]">
        {getScoreMessage(score)}
      </p>
    </div>
  );
}

function ProgressScoreCardContainer({ isLoading, score, category, onClick }: { isLoading: boolean; score: number | null; category: string | null; onClick?: () => void }) {
  return (
    <div
      className={`backdrop-blur-md bg-[rgba(253,245,241,0.14)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[211px] ${!isLoading && onClick ? "cursor-pointer" : ""}`}
      onClick={isLoading ? undefined : onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="absolute border border-[rgba(253,245,241,0.25)] inset-0 pointer-events-none rounded-[12px]" />
      {isLoading ? (
        <>
          <div className="w-full flex items-start justify-between">
            <div className="h-8 w-32 bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
            <div className="size-6 bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
          </div>
          <div className="w-full flex flex-col gap-4">
            <div className="h-14 w-40 bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
            <div className="h-6 w-full bg-[rgba(253,245,241,0.2)] rounded animate-pulse" />
          </div>
        </>
      ) : (
        <>
          <ProgressScoreContainer />
          <ProgressScoreValue score={score} category={category} />
        </>
      )}
    </div>
  );
}

function BiologicalAgeCardContainer({ isLoading, biologicalAge, chronologicalAge, phenoAgeAccel, onClick }: { isLoading: boolean; biologicalAge: number | null; chronologicalAge: number | null; phenoAgeAccel: number | null; onClick?: () => void }) {
  const getAgeMessage = (accel: number | null) => {
    if (accel === null) return "Calculating...";
    if (accel < -5) return "Much younger than your actual age";
    if (accel < 0) return `${Math.abs(accel).toFixed(1)} younger than your actual age`;
    if (accel > 5) return "Older than your actual age";
    if (accel > 0) return `${accel.toFixed(1)} years older than your actual age`;
    return "Same as your actual age";
  };

  return (
    <div
      className={`backdrop-blur-md bg-[rgba(253,245,241,0.14)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[211px] ${!isLoading && onClick ? "cursor-pointer" : ""}`}
      onClick={isLoading ? undefined : onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="absolute border border-[rgba(253,245,241,0.25)] inset-0 pointer-events-none rounded-[12px]" />
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
          <div className="content-stretch flex items-start justify-between relative shrink-0 w-full">
            <p className="font-sofia-pro font-medium leading-[1.3] not-italic relative shrink-0 text-[24px] text-nowrap text-white tracking-[-0.72px]">Biological age</p>
            <LucideArrowUpRight />
          </div>
          <div className="content-stretch flex flex-col gap-[4px] items-start not-italic relative shrink-0 w-full">
            <p className="font-sofia-pro font-normal leading-[1.3] relative shrink-0 text-[#fdf5f1] text-[0px] text-nowrap tracking-[-0.84px]">
              <span className="font-sofia-pro font-normal text-[56px]">{biologicalAge?.toFixed(1) ?? '--'}</span>
              <span className="font-sofia-pro font-normal text-[16px] text-[rgba(253,245,241,0.55)] tracking-[-0.48px]">/</span>
              <span className="font-sofia-pro font-medium text-[16px] text-[rgba(253,245,241,0.55)] tracking-[-0.48px]">{chronologicalAge ?? '--'}</span>
            </p>
            <p className="font-sofia-pro font-medium leading-[1.6] min-w-full relative shrink-0 text-[16px] text-[rgba(255,255,255,0.7)] w-[min-content]">
              {getAgeMessage(phenoAgeAccel)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function ActionPlanCardContainer({ isLoading, actionPlanDate, onClick }: { isLoading: boolean; actionPlanDate: string | null; onClick?: () => void }) {
  return (
    <div
      className={`backdrop-blur-md bg-[rgba(253,245,241,0.14)] flex flex-col justify-between items-start p-[24px] relative rounded-[12px] w-full h-[211px] overflow-hidden ${!isLoading && onClick ? "cursor-pointer" : ""}`}
      onClick={isLoading ? undefined : onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="absolute border border-[rgba(253,245,241,0.25)] inset-0 pointer-events-none rounded-[12px]" />
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
          <div className="flex items-start justify-between relative w-full shrink-0">
            <p className="font-sofia-pro font-medium leading-[1.3] not-italic relative shrink-0 text-[24px] text-nowrap text-white tracking-[-0.72px]">Your Action Plan</p>
            <LucideArrowUpRight />
          </div>
          {actionPlanDate ? (
            <div className="relative w-full flex-1 overflow-hidden my-2">
              <p
                className="font-sofia-pro font-medium leading-[1.6] not-italic text-[16px] text-[rgba(255,255,255,0.75)]"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 0%, black 30%, transparent 90%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 30%, transparent 90%)'
                }}
              >
                Your action plan has been updated to reflect the info in your questionnaire and metrics, including lifestyle, supplement, and testing recommendations.
              </p>
            </div>
          ) : (
            <div className="relative w-full flex-1 overflow-hidden my-2">
              <p className="font-sofia-pro font-medium leading-[1.6] not-italic text-[16px] text-[rgba(255,255,255,0.75)]">
                
              </p>
            </div>
          )}
          <p className="font-sofia-pro font-medium leading-[1.6] not-italic text-[16px] text-[rgba(255,255,255,0.7)] shrink-0">
            {actionPlanDate ? `Access your latest plan from ${new Date(actionPlanDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No action plan available yet"}
          </p>
        </>
      )}
    </div>
  );
}

export function CardsContainer9({ isLoading, progressScore, progressScoreCategory, biologicalAge, chronologicalAge, phenoAgeAccel, actionPlanDate, onProgressScoreClick, onBiologicalAgeClick }: Container9Props) {
  const router = useRouter();
  const [selectedMetric, setSelectedMetric] = useState<ModalMetric | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5
      }
    })
  };

  const scoreToModal = useCallback(
    (scoreType: "progress" | "biological"): ModalMetric => {
      if (scoreType === "progress") {
        const progressScoreValue = progressScore ?? 0;
        return {
          name: "Progress Score",
          description: "Your overall progress snapshot based on key metrics.",
          value: progressScoreValue,
          unit: "points",
          status: progressScoreValue >= 70 ? "Optimal" : "Needs Improvement",
          color: progressScoreValue >= 70 ? "#22C55E" : "#FDE047",
          range: "70 - 100",
        };
      }

      const age = chronologicalAge ?? 0;
      const biologicalAgeValue = biologicalAge ?? age;
      const ageDiff = age - biologicalAgeValue;

      return {
        name: "Biological Age (PhenoAge)",
        description: "How your body is aging at a cellular level.",
        value: biologicalAgeValue,
        unit: "years",
        status: ageDiff > 0 ? "Optimal" : ageDiff < 0 ? "Out of range" : "In range",
        color: ageDiff > 0 ? "#22C55E" : ageDiff < 0 ? "#EF4444" : "#FDE047",
      };
    },
    [progressScore, biologicalAge, chronologicalAge]
  );

  const handleProgressScoreClick = useCallback(() => {
    if (isLoading || !onProgressScoreClick) return;
    onProgressScoreClick();
  }, [isLoading, onProgressScoreClick]);

  const handleBiologicalAgeClick = useCallback(() => {
    if (isLoading || !onBiologicalAgeClick) return;
    onBiologicalAgeClick();
  }, [isLoading, onBiologicalAgeClick]);

  const handleActionPlanClick = useCallback(() => {
    if (isLoading) return;
    router.push("/client/action-plan");
  }, [isLoading, router]);

  const closeMetricModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedMetric(null), 300);
  }, []);

  return (
    <>
      <div className="flex flex-col xl:flex-row gap-[16px] items-stretch w-full">
        <motion.div 
          className="basis-0 grow"
          custom={0}
          initial="hidden"
          animate={isLoading ? "hidden" : "visible"}
          variants={cardVariants}
        >
          <ProgressScoreCardContainer
            isLoading={isLoading}
            score={progressScore}
            category={progressScoreCategory}
            onClick={handleProgressScoreClick}
          />
        </motion.div>
        <motion.div 
          className="basis-0 grow"
          custom={1}
          initial="hidden"
          animate={isLoading ? "hidden" : "visible"}
          variants={cardVariants}
        >
          <BiologicalAgeCardContainer
            isLoading={isLoading}
            biologicalAge={biologicalAge}
            chronologicalAge={chronologicalAge}
            phenoAgeAccel={phenoAgeAccel}
            onClick={handleBiologicalAgeClick}
          />
        </motion.div>
        <motion.div 
          className="basis-0 grow"
          custom={2}
          initial="hidden"
          animate={isLoading ? "hidden" : "visible"}
          variants={cardVariants}
        >
          <ActionPlanCardContainer
            isLoading={isLoading}
            actionPlanDate={actionPlanDate}
            onClick={handleActionPlanClick}
          />
        </motion.div>
      </div>

      {selectedMetric && (
        <MetricModal
          isOpen={isModalOpen}
          onClose={closeMetricModal}
          metric={selectedMetric}
        />
      )}
    </>
  );
}
