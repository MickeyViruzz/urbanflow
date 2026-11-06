import { useState, type FormEvent } from "react";
import { ExternalLink, Search } from "lucide-react";
import { IncidentDrawer } from "../components/IncidentDrawer";
import {
  Button,
  Card,
  CategoryBadge,
  EmptyState,
  ErrorState,
  Field,
  OriginBadge,
  PageHeader,
  Pagination,
  StatusBadge,
  TableSkeleton,
  inputClass,
  selectClass,
} from "../components/ui";
import { api } from "../lib/api";
import { trackEvent } from "../lib/analytics";
import { formatDate, formatDateTime } from "../lib/format";
import { useApiResource } from "../lib/useApi";

interface Filters {
  search: string;
  category: string;
  status: string;
  location: string;
  origin: string;
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  category: "",
  status: "",
  location: "",
  origin: "",
  date_from: "",
  date_to: "",
};

export default function DisruptionsPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const meta = useApiResource(() => api.getMeta(), []);
  const incidents = useApiResource(
    () =>
      api.getIncidents({
        search: applied.search || undefined,
        category: applied.category || undefined,
        status: applied.status || undefined,
        location: applied.location || undefined,
        origin: applied.origin || undefined,
        date_from: applied.date_from || undefined,
        date_to: applied.date_to || undefined,
        page,
        page_size: 20,
      }),
    [JSON.stringify(applied), page],
  );

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      setValidationError("The start date must be before the end date.");
      return;
    }
    setValidationError(null);
    setApplied(draft);
    setPage(1);
    if (draft.search.trim()) {
      trackEvent("search", {
        metadata: { query: draft.search.trim(), scope: "disruptions" },
      });
    } else {
      trackEvent("filter_apply", {
        metadata: {
          page: "disruptions",
          category: draft.category || "all",
          status: draft.status || "all",
          location: draft.location || "all",
        },
      });
    }
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setValidationError(null);
    setPage(1);
  };

  const data = incidents.data;
  const hasFilters = Object.values(applied).some(Boolean);

  return (
    <>
      <PageHeader
        eyebrow="Monitor"
        title="Road disruptions"
        description="Search and filter the collected traffic notices, construction records and road advisories. Open any record for its full details and source."
      />

      <Card className="mb-4 px-4 py-4">
        <form onSubmit={applyFilters}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Search" htmlFor="disruption-search" className="lg:col-span-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  id="disruption-search"
                  className={`${inputClass} pl-8`}
                  placeholder="Search title, description or location"
                  value={draft.search}
                  onChange={(event) => setDraft({ ...draft, search: event.target.value })}
                />
              </div>
            </Field>
            <Field label="Category" htmlFor="disruption-category">
              <select
                id="disruption-category"
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
            <Field label="Status" htmlFor="disruption-status">
              <select
                id="disruption-status"
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
            <Field label="Location" htmlFor="disruption-location">
              <input
                id="disruption-location"
                className={inputClass}
                list="disruption-location-options"
                placeholder="e.g. Bandra"
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
              />
              <datalist id="disruption-location-options">
                {(meta.data?.locations ?? []).map((location) => (
                  <option key={location.name} value={location.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Data origin" htmlFor="disruption-origin">
              <select
                id="disruption-origin"
                className={selectClass}
                value={draft.origin}
                onChange={(event) => setDraft({ ...draft, origin: event.target.value })}
              >
                <option value="">Live and demo</option>
                <option value="live">Live only</option>
                <option value="demo">Demo only</option>
              </select>
            </Field>
            <Field label="Starts from" htmlFor="disruption-from">
              <input
                id="disruption-from"
                type="date"
                className={inputClass}
                value={draft.date_from}
                max={draft.date_to || undefined}
                onChange={(event) => setDraft({ ...draft, date_from: event.target.value })}
              />
            </Field>
            <Field label="Starts on/before" htmlFor="disruption-to">
              <input
                id="disruption-to"
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
                "Results are ordered by incident start time, newest first."
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

      {incidents.loading && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[12px] text-muted">Loading collected records…</p>
          </div>
          <TableSkeleton rows={8} />
        </Card>
      )}

      {!incidents.loading && incidents.error && (
        <ErrorState
          title="Records unavailable"
          message={incidents.error}
          onRetry={incidents.reload}
        />
      )}

      {!incidents.loading && data && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-1 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">Collected records</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                {data.total.toLocaleString("en-IN")} matching record
                {data.total === 1 ? "" : "s"}
                {hasFilters ? " · filtered" : ""}
              </p>
            </div>
            <p className="text-[10.5px] text-muted">
              Click any row to open the complete record
            </p>
          </div>

          {data.items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No records match these filters"
                description="Try a different category, a broader date range, or reset the filters. Records come only from sources that have been collected successfully."
                action={
                  hasFilters ? (
                    <Button variant="secondary" size="sm" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left">
                  <thead>
                    <tr className="border-b border-line bg-[#FAFBFC] text-[10px] uppercase tracking-[0.06em] text-muted">
                      <th className="px-4 py-2.5 font-medium">Notice</th>
                      <th className="px-4 py-2.5 font-medium">Category</th>
                      <th className="px-4 py-2.5 font-medium">Affected location</th>
                      <th className="px-4 py-2.5 font-medium">Start</th>
                      <th className="px-4 py-2.5 font-medium">End</th>
                      <th className="px-4 py-2.5 font-medium">Source</th>
                      <th className="px-4 py-2.5 font-medium">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.items.map((incident) => (
                      <tr
                        key={incident.id}
                        className="cursor-pointer align-top transition-colors hover:bg-[#FAFBFC]"
                        onClick={() => setSelectedId(incident.id)}
                      >
                        <td className="max-w-[320px] px-4 py-3">
                          <button
                            type="button"
                            className="block text-left text-[12.5px] font-medium leading-4 text-ink hover:text-accent"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(incident.id);
                            }}
                          >
                            {incident.title}
                          </button>
                          <p className="mt-1 line-clamp-1 text-[10.5px] leading-4 text-muted">
                            {incident.summary ?? incident.description}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <StatusBadge status={incident.status} />
                            <OriginBadge origin={incident.origin} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <CategoryBadge category={incident.category} />
                        </td>
                        <td className="px-4 py-3 text-[11.5px] text-[#475467]">
                          {incident.location_name ?? "Not extracted"}
                          {incident.location_precision === "locality" && (
                            <span className="mt-0.5 block text-[9.5px] text-[#98A2B3]">
                              approximate locality
                            </span>
                          )}
                          {incident.location_precision === "segment" && (
                            <span className="mt-0.5 block text-[9.5px] text-[#98A2B3]">
                              OSM segment centre
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-[#475467]">
                          {incident.status === "unknown" ? "Not reported" : formatDate(incident.start_time)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-[#475467]">
                          {incident.status === "unknown"
                            ? "Not reported"
                            : incident.end_time
                              ? formatDate(incident.end_time)
                              : "Open-ended"}
                        </td>
                        <td className="max-w-[160px] px-4 py-3 text-[11px] text-[#475467]">
                          <span className="line-clamp-2">{incident.source_name}</span>
                          {incident.source_url && (
                            <a
                              href={incident.source_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:text-accent-dark"
                            >
                              Original <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-[#475467]">
                          {formatDateTime(incident.published_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.page}
                pages={data.pages}
                total={data.total}
                onPageChange={(next) => {
                  setPage(next);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </>
          )}
        </Card>
      )}

      <IncidentDrawer
        incidentId={selectedId}
        onClose={() => setSelectedId(null)}
        onSelect={setSelectedId}
      />
    </>
  );
}
