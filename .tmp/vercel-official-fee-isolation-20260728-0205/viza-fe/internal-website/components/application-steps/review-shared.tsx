import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export function SectionRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export function Section({
  title,
  children,
  onEdit,
  editLabel,
}: {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-sm text-brand-500">{title}</h3>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 rounded-full px-3 text-xs font-semibold text-brand-500 bg-brand-500/10 hover:bg-brand-500/15 hover:text-brand-500 focus-visible:ring-brand-500/40"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editLabel}
          </Button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
