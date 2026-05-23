import type { FieldStatus } from "@/lib/types";
import { STATUS_COLOR, STATUS_LABELS } from "@/lib/types";

export function StatusBadge({ status }: { status: FieldStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `color-mix(in oklab, ${STATUS_COLOR[status]} 18%, transparent)`, color: STATUS_COLOR[status] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
      {STATUS_LABELS[status]}
    </span>
  );
}