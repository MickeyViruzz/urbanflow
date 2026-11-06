import type { Category, IncidentStatus, Severity } from "./types";

const TIME_ZONE = "Asia/Kolkata";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: TIME_ZONE,
});

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return shortDateFormatter.format(date);
}

export function formatDayLabel(value: string): string {
  const date = new Date(`${value}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return value;
  return shortDateFormatter.format(date);
}

export function relativeTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const thresholds: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  for (const [unit, seconds] of thresholds) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "just now";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  Accident: "#B42318",
  "Road Closure": "#C4320A",
  Construction: "#7F56D9",
  "Traffic Diversion": "#1570EF",
  "Public Event": "#0E9384",
  "Parking Restriction": "#475467",
  Other: "#667085",
};

export const STATUS_COLORS: Record<IncidentStatus, string> = {
  active: "#B42318",
  upcoming: "#B54708",
  resolved: "#067647",
  unknown: "#667085",
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  active: "Active",
  upcoming: "Upcoming",
  resolved: "Resolved",
  unknown: "Unknown",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Low impact",
  medium: "Moderate impact",
  high: "High impact",
};

export const STATUS_BADGE_CLASSES: Record<IncidentStatus, string> = {
  active: "bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]",
  upcoming: "bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]",
  resolved: "bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]",
  unknown: "bg-[#F9FAFB] text-[#475467] border-[#E4E7EC]",
};

export const CATEGORY_BADGE_CLASSES: Record<Category, string> = {
  Accident: "bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]",
  "Road Closure": "bg-[#FFF6ED] text-[#C4320A] border-[#F9DBAF]",
  Construction: "bg-[#F4F3FF] text-[#6941C6] border-[#D9D6FE]",
  "Traffic Diversion": "bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]",
  "Public Event": "bg-[#F0FDF9] text-[#107569] border-[#99F6E0]",
  "Parking Restriction": "bg-[#F8FAFC] text-[#475467] border-[#E2E8F0]",
  Other: "bg-[#F8FAFC] text-[#475467] border-[#E2E8F0]",
};

export const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/map": "Traffic map",
  "/disruptions": "Road disruptions",
  "/analytics": "Traffic analytics",
  "/platform-analytics": "Platform analytics",
  "/route-check": "Route checker",
  "/data-sources": "Data pipeline",
  "/about": "About UrbanFlow",
};
