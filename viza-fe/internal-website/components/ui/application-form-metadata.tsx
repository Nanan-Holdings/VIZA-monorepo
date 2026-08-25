import { cn } from "@/lib/utils";

function ApplicationFormCharacterCount({
  current,
  maximum,
  className,
}: {
  current: number;
  maximum: number;
  className?: string;
}) {
  return (
    <span
      className={cn("pointer-events-none text-[11px] leading-none text-gray-400", className)}
      data-application-form-character-count="true"
    >
      {current}/{maximum}
    </span>
  );
}

function ApplicationFormAiFilledIndicator({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn("shrink-0 text-[11px] leading-none text-brand-500", className)}
      data-application-form-ai-filled="true"
    >
      {label}
    </span>
  );
}

export {
  ApplicationFormAiFilledIndicator,
  ApplicationFormCharacterCount,
};
