// @ts-nocheck - recommendation components removed during domain migration

"use client";

import Link from "next/link";
import type { TimelineTask, TimelineTaskId } from "@/app/actions/user-timeline";

// ============================================================
// TimelineCardRow primitive (copied from TimelineMockCards)
// ============================================================

type BadgeVariant = "primary" | "muted";

type TimelineCardRowProps = {
  title: string;
  subtitle: string;
  imageSrc: string;
  badgeText?: string;
  badgeVariant?: BadgeVariant;
  href?: string;
  onClick?: () => void;
};

function TimelineCardRow({
  title,
  subtitle,
  imageSrc,
  badgeText,
  badgeVariant = "primary",
  href,
  onClick,
}: TimelineCardRowProps) {
  const isInteractive = Boolean(href || onClick);

  const badgeClassName = (() => {
    switch (badgeVariant) {
      case "primary":
        return "bg-black text-white";
      case "muted":
        return "bg-[#dcdcdc] text-[#989898]";
    }
  })();

  const content = (
    <div
      className={
        "w-full rounded-[16px] border border-[#efefef] bg-white " +
        (isInteractive ? "hover:bg-[#fbfbfb] transition-colors cursor-pointer" : "")
      }
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex flex-col xl:flex-row xl:items-center w-full p-[16px] xl:p-[20px] gap-[12px] xl:gap-[24px] xl:justify-between">
        <div className="flex items-center gap-[16px] xl:gap-[20px] min-w-0">
          <div className="relative rounded-[8px] shrink-0 size-[72px] xl:size-[80px] overflow-hidden bg-[#f6f6f6]">
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              src={imageSrc}
            />
          </div>
          <div className="flex flex-col gap-[8px] min-w-0">
            <p className="font-sofia-pro font-medium leading-[1.3] not-italic text-[#3d3d3d] text-[20px] tracking-[-0.6px] truncate">
              {title}
            </p>
            <p className="font-sofia-pro font-normal leading-[1.3] not-italic text-[16px] text-[rgba(0,0,0,0.45)] tracking-[-0.48px] truncate">
              {subtitle}
            </p>
          </div>
        </div>

        {badgeText ? (
          <div
            className={
              "shrink-0 rounded-[999px] px-[24px] py-[8px] xl:py-[12px] font-sofia-pro font-medium text-[14px] xl:text-[16px] leading-[1.5] tracking-[-0.24px] w-full xl:w-auto text-center " +
              badgeClassName
            }
          >
            {badgeText}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

// Locked card variant — grayed out, no interaction (matches "Coming Soon" wearable style)
function LockedTimelineCardRow({
  title,
  subtitle,
  imageSrc,
  badgeText,
}: {
  title: string;
  subtitle: string;
  imageSrc: string;
  badgeText: string;
}) {
  return (
    <div className="w-full rounded-[16px] bg-[rgba(239,239,239,0.5)] overflow-hidden">
      <div className="flex flex-col xl:flex-row xl:items-center w-full p-[16px] xl:p-[20px] gap-[12px] xl:gap-[24px] xl:justify-between">
        <div className="flex items-center gap-[16px] xl:gap-[20px] min-w-0">
          <div className="relative rounded-[8px] shrink-0 size-[72px] xl:size-[80px] overflow-hidden bg-[#f6f6f6]">
            <img
              alt=""
              className="absolute inset-0 size-full object-cover opacity-50"
              src={imageSrc}
            />
          </div>
          <div className="flex flex-col gap-[8px] min-w-0">
            <p className="font-sofia-pro font-medium leading-[1.3] not-italic text-[#6d6d6d] text-[20px] tracking-[-0.6px] truncate">
              {title}
            </p>
            <p className="font-sofia-pro font-normal leading-[1.3] not-italic text-[16px] text-[rgba(0,0,0,0.45)] tracking-[-0.48px] truncate">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="shrink-0 rounded-[999px] px-[24px] py-[8px] xl:py-[12px] font-sofia-pro font-medium text-[16px] leading-[1.5] tracking-[-0.24px] bg-[#dcdcdc] text-[#989898] w-full xl:w-auto text-center">
          {badgeText}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Task config — maps each task ID to card content per status
// ============================================================

function formatDateLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(parsed);
}

interface TaskStateConfig {
  subtitle: (meta?: TimelineTask["metadata"]) => string;
  badge: string;
  href?: string;
  onClick?: "openBloodPanel" | "openShenAI";
}

interface TaskCardConfig {
  title: string;
  image: string;
  pending: TaskStateConfig;
  locked: {
    subtitle: string;
    badge: string;
  };
  done: TaskStateConfig;
}

const TASK_CONFIG: Record<TimelineTaskId, TaskCardConfig> = {
  complete_questionnaire: {
    title: "Complete your profile",
    image: "/figma-assets/frame-profile.png",
    pending: {
      subtitle: (meta) =>
        meta?.skipped
          ? "You skipped this — finish when you're ready"
          : "Answer a few questions about yourself",
      badge: "Start",
      href: "/client/about-me-form",
    },
    locked: {
      subtitle: "Not available",
      badge: "Locked",
    },
    done: {
      subtitle: () => "Profile completed",
      badge: "View",
      href: "/client/settings",
    },
  },

  measure_profile_data: {
    title: "Measure your profile_data",
    image: "/figma-assets/frame-timeline-profile_data.png",
    pending: {
      subtitle: () => "Record your baseline measurements",
      badge: "Start",
      onClick: "openShenAI",
    },
    locked: {
      subtitle: "Not available yet",
      badge: "Locked",
    },
    done: {
      subtitle: () => "Data recorded",
      badge: "Done",
    },
  },

  book_first_blood_panel: {
    title: "Book your blood panel",
    image: "/figma-assets/frame-badge.png",
    pending: {
      subtitle: () => "Schedule your first lab appointment",
      badge: "Book now",
      onClick: "openBloodPanel",
    },
    locked: {
      subtitle: "Not available yet",
      badge: "Locked",
    },
    done: {
      subtitle: (meta) => {
        const date = formatDateLabel(meta?.bookingDate);
        return date ? `Booked for ${date}` : "Appointment booked";
      },
      badge: "View",
    },
  },

  review_lab_results: {
    title: "Review your lab results",
    image: "/figma-assets/frame-action-plan-1.png",
    pending: {
      subtitle: () => "Your results are ready to view",
      badge: "View",
      href: "/client/data",
    },
    locked: {
      subtitle: "Available after your blood panel is processed",
      badge: "Not yet available",
    },
    done: {
      subtitle: () => "Results available",
      badge: "Open",
      href: "/client/data",
    },
  },

  read_action_plan: {
    title: "Read your action plan",
    image: "/figma-assets/frame-timeline-results.png",
    pending: {
      subtitle: () => "Your personalised plan is ready",
      badge: "Open",
      href: "/client/action-plan",
    },
    locked: {
      subtitle: "Being prepared for you",
      badge: "Not yet available",
    },
    done: {
      subtitle: (meta) => {
        const date = formatDateLabel(meta?.actionPlanDate);
        return date ? `Plan from ${date}` : "Plan available";
      },
      badge: "Open",
      href: "/client/action-plan",
    },
  },

  book_second_blood_panel: {
    title: "Book your follow-up panel",
    image: "/figma-assets/frame-timeline-followup.jpg",
    pending: {
      subtitle: () => "Schedule your second blood panel",
      badge: "Book now",
      onClick: "openBloodPanel",
    },
    locked: {
      subtitle: "Available after your first results arrive",
      badge: "Not yet available",
    },
    done: {
      subtitle: (meta) => {
        const date = formatDateLabel(meta?.bookingDate);
        return date ? `Booked for ${date}` : "Appointment booked";
      },
      badge: "Done",
    },
  },
};

// ============================================================
// Single task card renderer
// ============================================================

function TaskCard({
  task,
  onOpenBloodPanel,
  onOpenShenAI,
}: {
  task: TimelineTask;
  onOpenBloodPanel?: () => void;
  onOpenShenAI?: () => void;
}) {
  const config = TASK_CONFIG[task.id];
  if (!config) return null;

  if (task.status === "locked") {
    return (
      <LockedTimelineCardRow
        title={config.title}
        subtitle={config.locked.subtitle}
        imageSrc={config.image}
        badgeText={config.locked.badge}
      />
    );
  }

  // At this point task.status is "pending" or "done" (locked is handled above)
  const stateConfig = task.status === "done" ? config.done : config.pending;
  const subtitle = stateConfig.subtitle(task.metadata);
  const badge = stateConfig.badge;
  const href = stateConfig.href;

  const onClick = (() => {
    if (stateConfig.onClick === "openBloodPanel") return onOpenBloodPanel;
    if (stateConfig.onClick === "openShenAI") return onOpenShenAI;
    return undefined;
  })();

  return (
    <TimelineCardRow
      title={config.title}
      subtitle={subtitle}
      imageSrc={config.image}
      badgeText={badge}
      badgeVariant={task.status === "done" ? "muted" : "primary"}
      href={href}
      onClick={onClick}
    />
  );
}

// ============================================================
// Main exported component
// ============================================================

type TimelineCardsProps = {
  tasks: TimelineTask[];
  recommendations?: RecommendationResponse | null;
  userName?: string | null;
  onBookBloodPanel?: () => void;
  onOpenShenAIMeasurement?: () => void;
};

export function TimelineCards({
  tasks,
  recommendations,
  userName,
  onBookBloodPanel,
  onOpenShenAIMeasurement,
}: TimelineCardsProps) {
  // TODO: Temporarily hide these steps until they're ready
  const visibleTasks = tasks.filter(
    (t) => t.id !== "measure_profile_data" && t.id !== "read_action_plan"
  );

  // Pending tasks come before locked ones in Next Steps
  const nextStepTasks = [
    ...visibleTasks.filter((t) => t.status === "pending"),
    ...visibleTasks.filter((t) => t.status === "locked"),
  ];
  const finishedTasks = visibleTasks.filter((t) => t.status === "done");

  return (
    <div className="w-full max-w-[1090px] mt-5 mb-12 flex flex-col gap-[56px]">
      {/* Next Steps */}
      {nextStepTasks.length > 0 && (
        <section className="flex flex-col gap-[16px]">
          {recommendations && (
            <ProductRecommendationsCard
              recommendations={recommendations}
              userName={userName}
            />
          )}

          {nextStepTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpenBloodPanel={onBookBloodPanel}
              onOpenShenAI={onOpenShenAIMeasurement}
            />
          ))}
        </section>
      )}

      {/* Get the most out of VIZA — static, unchanged */}
      <section className="flex flex-col gap-[16px]">
        <p className="font-sofia-pro font-normal leading-[1.3] not-italic text-[20px] text-[rgba(0,0,0,0.45)] tracking-[-0.6px]">
          Get the most out of VIZA
        </p>

        <div className="w-full rounded-[16px] border border-[#efefef] bg-white overflow-hidden">
          <div className="flex flex-col xl:flex-row xl:items-center w-full p-[16px] xl:p-[20px] gap-[12px] xl:gap-[24px] xl:justify-between">
            <div className="flex items-center gap-[16px] xl:gap-[20px] min-w-0">
              <div className="relative rounded-[8px] shrink-0 size-[72px] xl:size-[80px] overflow-hidden bg-[#f6f6f6]">
                <img
                  alt=""
                  className="absolute inset-0 size-full object-cover opacity-40"
                  src="/figma-assets/frame-wearable.png"
                />
              </div>
              <div className="flex flex-col gap-[8px] min-w-0 opacity-40">
                <p className="font-sofia-pro font-medium leading-[1.3] not-italic text-[#3d3d3d] text-[20px] tracking-[-0.6px] truncate">
                  Wearable
                </p>
                <p className="font-sofia-pro font-normal leading-[1.3] not-italic text-[16px] text-[rgba(0,0,0,0.45)] tracking-[-0.48px] truncate">
                  Sync your data from your data sources
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-[999px] px-[24px] py-[8px] xl:py-[12px] font-sofia-pro font-medium text-[14px] xl:text-[16px] leading-[1.5] tracking-[-0.24px] border border-[#d5d5d5] text-[#b0b0b0] w-full xl:w-auto text-center">
              Coming Soon
            </div>
          </div>
        </div>
      </section>

      {/* Finished Tasks */}
      {finishedTasks.length > 0 && (
        <section className="flex flex-col gap-[16px]">
          <p className="font-sofia-pro font-normal leading-[1.3] not-italic text-[20px] text-[rgba(0,0,0,0.45)] tracking-[-0.6px]">
            Finished tasks
          </p>
          {finishedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpenBloodPanel={onBookBloodPanel}
              onOpenShenAI={onOpenShenAIMeasurement}
            />
          ))}
        </section>
      )}
    </div>
  );
}
