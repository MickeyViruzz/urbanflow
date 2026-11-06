import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiError } from "../lib/api";
import { trackEvent } from "../lib/analytics";
import {
  formatDateTime,
  SEVERITY_LABELS,
} from "../lib/format";
import type { Incident } from "../lib/types";
import {
  Badge,
  Button,
  CategoryBadge,
  ErrorState,
  OriginBadge,
  Skeleton,
  StatusBadge,
} from "./ui";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-line py-2.5 last:border-0">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-muted">{label}</dt>
      <dd className="mt-1 text-[12.5px] leading-5 text-ink">{value}</dd>
    </div>
  );
}

export function IncidentDrawer({
  incidentId,
  onClose,
  onSelect,
}: {
  incidentId: number | null;
  onClose: () => void;
  onSelect?: (id: number) => void;
}) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!incidentId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setIncident(null);
    trackEvent("incident_view", { metadata: { incident_id: incidentId } });
    api
      .getIncident(incidentId)
      .then((data) => {
        if (active) {
          setIncident(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Could not load this incident.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [incidentId, reloadKey]);

  useEffect(() => {
    if (!incidentId) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    panel?.focus();

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
      previousFocus?.focus?.();
    };
  }, [incidentId]);

  if (!incidentId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[900]">
      <button
        type="button"
        aria-label="Close incident details"
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 animate-fade-in"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line bg-white shadow-panel outline-none animate-slide-in"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2
            id="incident-drawer-title"
            className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted"
          >
            Incident record
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
              <div className="space-y-2 pt-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          )}

          {!loading && error && (
            <ErrorState
              title="Incident unavailable"
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          )}

          {!loading && incident && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <CategoryBadge category={incident.category} />
                <StatusBadge status={incident.status} />
                <OriginBadge origin={incident.origin} />
                {incident.severity === "high" && (
                  <Badge className="border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]">
                    High impact
                  </Badge>
                )}
              </div>

              <h3 className="mt-3 text-[19px] font-semibold leading-6 tracking-[-0.02em] text-ink">
                {incident.title}
              </h3>
              <p className="mt-1.5 text-[12.5px] text-muted">
                {incident.location_name ?? "Location not reported"}
                {incident.location_precision === "locality" && " · Approximate locality centroid"}
                {incident.location_precision === "segment" && " · OpenStreetMap road-segment centre"}
              </p>

              <p className="mt-4 text-[13px] leading-6 text-[#344054]">
                {incident.description ?? incident.summary}
              </p>

              {incident.summary && incident.description && incident.summary !== incident.description && (
                <div className="mt-4 rounded-md border border-line bg-[#FAFBFC] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Extracted summary
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#475467]">{incident.summary}</p>
                </div>
              )}

              {incident.origin === "demo" && (
                <div className="mt-4 rounded-md border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-2.5">
                  <p className="text-[11.5px] leading-5 text-[#475467]">
                    This is a synthetic demonstration record from the UrbanFlow sample dataset.
                    It is not a live traffic advisory.
                  </p>
                </div>
              )}

              {incident.source_slug === "osm-overpass" && (
                <div className="mt-4 rounded-md border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted">
                    OpenStreetMap record
                  </p>
                  <p className="mt-1 text-[11.5px] leading-5 text-[#475467]">
                    This record is derived from an OpenStreetMap construction tag. The operational
                    status and start/end dates are not confirmed by the source. The displayed date
                    is the OSM last-edit date, and the coordinates are the road-segment centre —
                    not an exact incident position. Verify with official advisories.
                  </p>
                </div>
              )}

              <dl className="mt-5">
                <DetailRow label="Location" value={incident.location_name ?? "Not extracted"} />
                <DetailRow
                  label="Coordinates"
                  value={
                    incident.latitude !== null && incident.longitude !== null
                      ? `${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)} · ${
                          incident.location_precision === "segment"
                            ? "OSM road-segment centre"
                            : incident.location_precision === "locality"
                              ? "approximate locality centroid"
                              : "location precision unknown"
                        }`
                      : "No coordinates available"
                  }
                />
                <DetailRow
                  label="Starts"
                  value={
                    incident.status === "unknown"
                      ? "Not reported by source"
                      : formatDateTime(incident.start_time)
                  }
                />
                <DetailRow
                  label="Ends"
                  value={
                    incident.status === "unknown"
                      ? "Not reported by source"
                      : formatDateTime(incident.end_time)
                  }
                />
                {incident.status === "unknown" && (
                  <DetailRow
                    label="Recorded date"
                    value={`${formatDateTime(
                      incident.last_updated_at,
                    )} · source last-edit date, not a start date`}
                  />
                )}
                <DetailRow label="Published" value={formatDateTime(incident.published_at)} />
                <DetailRow label="Last updated" value={formatDateTime(incident.last_updated_at)} />
                <DetailRow label="Impact" value={SEVERITY_LABELS[incident.severity]} />
                {incident.classification && (
                  <DetailRow
                    label="Classification basis"
                    value={
                      incident.classification.method === "supplied"
                        ? "Category assigned by the source"
                        : `${incident.classification.method} · ${Math.round(
                            incident.classification.confidence * 100,
                          )}% confidence`
                    }
                  />
                )}
                {incident.status === "unknown" && (
                  <DetailRow
                    label="Status basis"
                    value="Not confirmed by the source; shown as unknown rather than assumed active."
                  />
                )}
              </dl>

              <div className="mt-5 rounded-md border border-line px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Source attribution
                </p>
                <p className="mt-1.5 text-[12.5px] font-medium text-ink">
                  {incident.source_name ?? "Unknown source"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span>{incident.source_type}</span>
                  <span className="text-[#D0D5DD]">·</span>
                  <span>{incident.origin === "demo" ? "Synthetic sample" : "Collected record"}</span>
                  {incident.external_id && (
                    <>
                      <span className="text-[#D0D5DD]">·</span>
                      <span className="font-mono text-[10px]">{incident.external_id}</span>
                    </>
                  )}
                </div>
                {incident.source_url ? (
                  <a
                    href={incident.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:text-accent-dark"
                  >
                    Open original source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="mt-2 text-[11px] text-muted">
                    No original public URL is available for this record.
                  </p>
                )}
              </div>

              {incident.related && incident.related.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Other records at this location
                  </p>
                  <div className="space-y-1.5">
                    {incident.related.map((related) => (
                      <button
                        key={related.id}
                        type="button"
                        onClick={() => onSelect?.(related.id)}
                        className="w-full rounded-md border border-line px-3 py-2 text-left transition-colors hover:bg-canvas"
                      >
                        <p className="text-[12px] font-medium leading-4 text-ink">{related.title}</p>
                        <p className="mt-0.5 text-[10.5px] text-muted">
                          {related.category} · {formatDateTime(related.start_time)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <p className="text-[10.5px] text-muted">
            Records are shown as collected. Verify with official advisories.
          </p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
