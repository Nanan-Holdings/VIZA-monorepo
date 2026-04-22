"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProgressRailProps {
  step: number;
  total: number;
  label: string;
  onBack: () => void;
  backLabel: string;
}

export function ProgressRail({ step, total, label, onBack, backLabel }: ProgressRailProps) {
  const percent = Math.round((step / total) * 100);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-9 gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
          aria-label={backLabel}
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-brand-50"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
