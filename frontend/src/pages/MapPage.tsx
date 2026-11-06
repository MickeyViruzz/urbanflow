import { useMemo, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import { IncidentDrawer } from "../components/IncidentDrawer";
import { TrafficMap } from "../components/TrafficMap";
import {
  Button,
  Card,
  CategoryBadge,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Skeleton,
  StatusBadge,
  inputClass,
  selectClass,
} from "../components/ui";
import { api } from "../lib/api";
import { trackEvent } from "../lib/analytics";
import { formatShortDate } from "../lib/format";
import type { Incident } from "../lib/types";
import { useApiResource } from "../lib/useApi";

interface Filters {
  category: string;
  location: string;
  status: string;
  origin: string;
  date_from: string;
  date_to: string;
}

const MAP_LIMIT = 600;

const EMPTY_FILTERS: Filters = {
  category: "",
  location: "",
  status: "",
  origin: "",
  date_from: "",
  date_to: "",
};

export default function MapPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const meta = useApiResource(() => api.getMeta(), []);
  const mapData = useApiResource(
    () =>
      api.getMapIncidents({
        category: applied.category || undefined,
        location: applied.location || undefined,
        status: applied.status || undefined,
        origin: applied.origin || undefined,
        date_from: applied.date_from || undefined,
        date_to: applied.date_to || undefined,
        limit: MAP_LIMIT,
      }),
    [
      applied.category,
      applied.location,
      applied.status,
      applied.origin,
      applied.date_from,
      applied.date_to,
    ],
  );

  const activeFilterCount = useMemo(
    () => Object.values(applied).filter(Boolean).length,
    [applied],
  );

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      setValidationError("The start date must be before the end date.");
      return;
    }
    setValidationError(null);
    setApplied(draft);
    trackEvent("filter_apply", {
      metadata: {
        page: "map",
        category: draft.category || "all",
        status: draft.status || "all",
        location: draft.location || "all",
        origin: draft.origin || "all",
      },
    });
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setValidationError(null);
  };

  const handleMarkerOpen = (id: number) => {
    trackEvent("map_interaction", { metadata: { action: "marker_open", incident_id: id } });
    setSelectedId(id);
  };

  const incidents = mapData.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Monitor"
        title="Traffic map"
        description="Explore recorded disruptions geographically. Coordinates come from locality centroids or OpenStreetMap geometry, never invented positions."
      />

      <Card className="mb-4 px-4 py-4">
        <form onSubmit={applyFilters}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field label="Category" htmlFor="map-category">
              <select
                id="map-category"
                className={selectClass}
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              >
                <option value="">All categories</option>
                {(meta.data?.categories ?? []).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location" htmlFor="map-location">
              <input
                id="map-location"
                className={inputClass}
                list="map-location-options"
                placeholder="e.g. Andheri"
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
              />
              <datalist id="map-location-options">
                {(meta.data?.locations ?? []).map((location) => (
                  <option key={location.name} value={location.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Status" htmlFor="map-status">
              <select
                id="map-status"
                className={selectClass}
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="resolved">Resolved</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="Data origin" htmlFor="map-origin">
              <select
                id="map-origin"
                className={selectClass}
                value={draft.origin}
                onChange={(event) => setDraft({ ...draft, origin: event.target.value })}
              >
                <option value="">All records</option>
                <option value="live">Live only</option>
                <option value="demo">Demo only</option>
              </select>
            </Field>
            <Field label="From date" htmlFor="map-from">
              <input
                id="map-from"
                type="date"
                className={inputClass}
                value={draft.date_from}
                max={draft.date_to || undefined}
                onChange={(event) => setDraft({ ...draft, date_from: event.target.value })}
              />
            </Field>
            <Field label="To date" htmlFor="map-to">
              <input
                id="map-to"
                type="date"
                className={inputClass}
                value={draft.date_to}
                min={draft.date_from || undefined}
                onChange={(event) => setDraft({ ...draft, date_to: event.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted">
              {validationError ? (
                <span className="text-[#B42318]">{validationError}</span>
              ) : (
                "Filters combine with AND. Date filters use the incident start date."
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                Reset
              </Button>
              <Button type="submit" size="sm">
                Apply filters
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          {mapData.loading ? (
            <Skeleton className="h-[560px] w-full rounded-card" />
          ) : mapData.error ? (
            <ErrorState
              title="Map data unavailable"
              message={mapData.error}
              onRetry={mapData.reload}
            />
          ) : (
            <TrafficMap
              incidents={incidents}
              height={560}
              onSelect={handleMarkerOpen}
              fitRoutes={false}
            />
          )}
          <div className="mt-2 flex flex-col gap-1 text-[10.5px] leading-4 text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              Locations are locality centroids or OpenStreetMap road-segment centres. OSM records
              carry an unconfirmed status. Click a marker to view its record.
            </p>
            <p className="shrink-0">
              {mapData.data ? `${mapData.data.total} mapped records` : ""}
              {mapData.data?.truncated ? ` · showing the first ${MAP_LIMIT}` : ""}
            </p>
          </div>
        </div>

        <Card className="flex max-h-[606px] flex-col overflow-hidden xl:col-span-4">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">Mapped disruptions</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                {activeFilterCount
                  ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
                  : "All recorded disruptions"}
              </p>
            </div>
            <span className="rounded-full border border-line bg-[#FAFBFC] px-2 py-0.5 text-[10.5px] font-medium text-[#475467]">
              {incidents.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {mapData.loading && (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                ))}
              </div>
            )}
            {!mapData.loading && incidents.length === 0 && (
              <div className="p-4">
                <EmptyState
                  title="No mapped records found"
                  description="Try removing a filter or widening the date range. Records without coordinates cannot appear on the map."
                  compact
                />
              </div>
            )}
            <ul className="divide-y divide-line">
              {incidents.map((incident: Incident) => (
                <li key={incident.id}>
                  <button
                    type="button"
                    onClick={() => handleMarkerOpen(incident.id)}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-[#FAFBFC]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[12px] font-medium leading-4 text-ink">
                        {incident.title}
                      </p>
                      <StatusBadge status={incident.status} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted">
                      <MapPin className="h-3 w-3" />
                      {incident.location_name ?? "Location not reported"}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <CategoryBadge category={incident.category} />
                      <span className="text-[10px] text-muted">
                        {incident.status === "unknown"
                          ? "Start not reported"
                          : formatShortDate(incident.start_time)}
                      </span>
                      {incident.origin === "demo" && (
                        <span className="text-[10px] text-[#98A2B3]">· demo</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="border-t border-line px-4 py-2 text-[10px] text-muted">
            Ordered by most recent recorded date.
          </p>
        </Card>
      </div>

      <IncidentDrawer
        incidentId={selectedId}
        onClose={() => setSelectedId(null)}
        onSelect={setSelectedId}
      />
    </>
  );
}
