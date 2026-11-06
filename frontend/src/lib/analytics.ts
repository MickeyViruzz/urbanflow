import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const SESSION_KEY = "urbanflow.analytics.session";

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return "anonymous-session";
  }
}

export type TrackedEvent =
  | "page_view"
  | "search"
  | "map_interaction"
  | "incident_view"
  | "route_check"
  | "filter_apply"
  | "feature_use";

interface TrackOptions {
  path?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export function trackEvent(eventType: TrackedEvent, options: TrackOptions = {}): void {
  const payload = {
    event_type: eventType,
    page_path: options.path ?? window.location.pathname,
    metadata: options.metadata ?? {},
    session_id: sessionId(),
  };
  fetch(`${API_BASE}/api/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Analytics must never break the product experience.
  });
}

export function usePageViews(): void {
  const location = useLocation();
  useEffect(() => {
    trackEvent("page_view", {
      path: `${location.pathname}${location.search}`,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
    // Only pathname changes create a new page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
