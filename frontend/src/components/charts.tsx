import type { ReactNode } from "react";
import { Card, EmptyState, SectionTitle } from "./ui";

interface TooltipItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  labelType?: "date" | "text";
  valueSuffix?: string;
}

export function formatTooltipLabel(label: string | number | undefined, type: "date" | "text"): string {
  if (label === undefined) return "";
  if (type === "date") {
    const text = String(label);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const date = new Date(`${text}T12:00:00+05:30`);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        }).format(date);
      }
    }
  }
  return String(label);
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelType = "text",
  valueSuffix = "",
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[140px] rounded-md border border-line bg-white px-3 py-2 shadow-panel">
      <p className="mb-1 text-[11px] font-medium text-muted">
        {formatTooltipLabel(label, labelType)}
      </p>
      <div className="space-y-0.5">
        {payload.map((item, index) => (
          <div key={`${item.name ?? index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[#475467]">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: item.color ?? "#1D4ED8" }}
              />
              {item.name ?? item.dataKey}
            </span>
            <span className="text-[11.5px] font-medium text-ink tabular-nums">
              {typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const axisStyle = {
  fontSize: 11,
  fill: "#667085",
} as const;

export const gridStroke = "#EDF0F3";

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  height = 280,
  available = true,
  emptyTitle = "Not enough data yet",
  emptyDescription = "There are not enough collected records to build this view. Run the pipeline or widen the date range.",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: number;
  available?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <Card className={className}>
      <SectionTitle title={title} description={description} action={action} />
      <div className="px-4 pb-4" style={{ height }}>
        {available ? (
          children
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} compact />
        )}
      </div>
    </Card>
  );
}

export function LegendDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
      style={{ backgroundColor: color }}
    />
  );
}

export function ChartLegend({
  items,
  className = "",
}: {
  items: { label: string; color: string; value?: string | number }[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <LegendDot color={item.color} />
          {item.label}
          {item.value !== undefined && (
            <span className="font-medium text-ink tabular-nums">{item.value}</span>
          )}
        </span>
      ))}
    </div>
  );
}
