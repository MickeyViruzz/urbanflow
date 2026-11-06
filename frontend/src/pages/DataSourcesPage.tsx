import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  SectionTitle,
  Skeleton,
  StatCard,
  TableSkeleton,
  inputClass,
} from "../components/ui";
import { api, ApiError } from "../lib/api";
import { trackEvent } from "../lib/analytics";
import {
  formatDateTime,
  formatNumber,
  relativeTime,
} from "../lib/format";
import type { CollectionLog, SourceRow } from "../lib/types";
import { useApiResource } from "../lib/useApi";

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const classes =
    normalized === "operational" || normalized === "success"
      ? "border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]"
      : normalized === "partial" || normalized === "running"
        ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
        : normalized === "failed"
          ? "border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]"
          : "border-line bg-[#FAFBFC] text-[#475467]";
  return (
    <Badge className={classes}>
      <span className="capitalize">{status}</span>
    </Badge>
  );
}

function SourceRowView({ source }: { source: SourceRow }) {
  const lastRun = source.latest_run;
  return (
    <tr className="align-top">
      <td className="max-w-[330px] px-4 py-3.5">
        <p className="text-[12.5px] font-medium text-ink">{source.name}</p>
        {source.description && (
          <p className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-muted">{source.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          {source.base_url && (
            <a
              href={source.base_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-dark"
            >
              Source site <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          {source.licence_note && (
            <span className="line-clamp-1 text-[#98A2B3]">{source.licence_note}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5 text-[11px] text-[#475467]">{source.source_type}</td>
      <td className="px-4 py-3.5">
        <StatusPill status={source.status} />
        {lastRun?.message && (
          <p
            className="mt-1.5 line-clamp-2 max-w-[200px] text-[9.5px] leading-4 text-muted"
            title={lastRun.message}
          >
            {lastRun.message}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-[11px] text-[#475467]">
        {source.last_success_at ? (
          <>
            {formatDateTime(source.last_success_at)}
            <span className="mt-0.5 block text-[9.5px] text-[#98A2B3]">
              {relativeTime(source.last_success_at)}
            </span>
          </>
        ) : (
          "No successful run"
        )}
      </td>
      <td className="px-4 py-3.5 text-[11px] tabular-nums text-[#475467]">
        {source.weather_count > 0 ? (
          <>
            {formatNumber(source.weather_count)} weather rows
            <span className="mt-0.5 block text-[9.5px] text-[#98A2B3]">weather observations</span>
          </>
        ) : (
          <>
            {formatNumber(source.record_count)} records
            <span className="mt-0.5 block text-[9.5px] text-[#98A2B3]">incidents</span>
          </>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-[10.5px] tabular-nums text-[#475467]">
        {lastRun ? (
          <div className="space-y-0.5">
            <p>
              <span className="text-muted">New</span> {lastRun.records_inserted} ·{" "}
              <span className="text-muted">Upd</span> {lastRun.records_updated}
            </p>
            <p>
              <span className="text-muted">Dup</span> {lastRun.duplicates} ·{" "}
              <span className="text-muted">Rej</span> {lastRun.rejected}
            </p>
          </div>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

function LogRow({ log }: { log: CollectionLog }) {
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-[#475467]">
        {formatDateTime(log.started_at)}
      </td>
      <td className="px-4 py-3">
        <p className="text-[11.5px] font-medium text-ink">{log.source_name ?? "Pipeline"}</p>
        <p className="mt-0.5 text-[9.5px] text-muted">
          {log.pipeline} · {log.triggered_by}
        </p>
      </td>
      <td className="px-4 py-3">
        <StatusPill status={log.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[10.5px] tabular-nums text-[#475467]">
        {log.records_fetched} / {log.records_inserted} / {log.records_updated}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[10.5px] tabular-nums text-[#475467]">
        {log.duplicates} / {log.rejected}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[10.5px] tabular-nums text-[#475467]">
        {log.duration_seconds !== null ? `${log.duration_seconds}s` : "—"}
      </td>
      <td className="max-w-[210px] px-4 py-3">
        <p className="line-clamp-2 text-[10px] leading-4 text-muted" title={log.message ?? ""}>
          {log.message ?? "—"}
        </p>
      </td>
    </tr>
  );
}

export default function DataSourcesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [token, setToken] = useState("");
  const [running, setRunning] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const sources = useApiResource(() => api.getSources(), []);
  const logs = useApiResource(() => api.getPipelineLogs(25), []);
  const reloadSources = sources.reload;
  const reloadLogs = logs.reload;

  useEffect(() => {
    if (!polling) return;
    const interval = window.setInterval(() => {
      reloadSources();
      reloadLogs();
    }, 3000);
    const stop = window.setTimeout(() => {
      setPolling(false);
      setRefreshNotice(
        "Polling window ended. Use Refresh view to check whether the collection has finished.",
      );
      reloadSources();
      reloadLogs();
    }, 180000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [polling, reloadSources, reloadLogs]);

  const openModal = () => {
    setRefreshError(null);
    setModalOpen(true);
    trackEvent("feature_use", { metadata: { feature: "manual_pipeline_refresh" } });
  };

  const runCollection = async (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim()) {
      setRefreshError("Enter the admin token configured on the backend.");
      return;
    }
    setRunning(true);
    setRefreshError(null);
    try {
      const response = await api.runPipeline(token.trim());
      setModalOpen(false);
      setToken("");
      setRefreshNotice(response.message);
      setPolling(true);
      reloadLogs();
      reloadSources();
    } catch (error) {
      setRefreshError(
        error instanceof ApiError ? error.message : "Could not start the data collection.",
      );
    } finally {
      setRunning(false);
    }
  };

  const summary = sources.data?.summary;
  const sourceRows = sources.data?.sources ?? [];
  const logRows = logs.data?.items ?? [];
  const liveSources = sourceRows.filter((source) => source.source_type !== "Sample dataset");
  const operationalLive = liveSources.filter(
    (source) => source.status === "operational",
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Data sources & pipeline"
        description="Trace where every record comes from, when collection last succeeded and what was rejected or deduplicated. Manual collection is restricted to administrators."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                reloadLogs();
                reloadSources();
              }}
            >
              Refresh view
            </Button>
            <Button size="sm" onClick={openModal}>
              Run collection
            </Button>
          </>
        }
      />

      {refreshNotice && (
        <div className="mb-4 flex flex-col gap-2 rounded-card border border-[#D1E0FF] bg-[#F5F8FF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] leading-5 text-[#344054]">{refreshNotice}</p>
          <span className="flex items-center gap-2 text-[10.5px] font-medium text-[#175CD3]">
            {polling && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            )}
            {polling ? "Refreshing logs every 3s" : "Log refreshed"}
          </span>
        </div>
      )}

      {sources.loading && !sources.data && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="px-4 py-4">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-2 h-2.5 w-28" />
            </Card>
          ))}
        </div>
      )}

      {sources.error && !sources.data && (
        <ErrorState
          title="Pipeline data unavailable"
          message={sources.error}
          onRetry={sources.reload}
        />
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Records available"
              value={formatNumber(summary.total_records)}
              meta="Incident records currently stored"
              accent="#475467"
            />
            <StatCard
              label="Live records"
              value={formatNumber(summary.live_records)}
              meta="Collected from external sources"
              accent="#1570EF"
            />
            <StatCard
              label="Demo records"
              value={formatNumber(summary.demo_records)}
              meta="Synthetic records, labelled in the UI"
              accent="#B54708"
            />
            <StatCard
              label="Live sources operational"
              value={`${operationalLive} / ${liveSources.length}`}
              meta="External collectors, latest attempt"
              accent="#067647"
            />
          </div>

          {sources.error && (
            <div className="mt-4 rounded-card border border-[#FECDCA] bg-[#FFFCFC] px-4 py-2.5 text-[11px] text-[#B42318]">
              Refresh failed: {sources.error}. Showing the last successfully loaded data.
            </div>
          )}

          <Card className="mt-4 overflow-hidden">
            <SectionTitle
              title="Collection sources"
              description="Each record retains its source attribution and original link where available"
              action={
                <span className="text-[10.5px] text-muted">
                  Last run {summary.last_run_at ? relativeTime(summary.last_run_at) : "not recorded"}
                </span>
              }
            />
            {sourceRows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No sources registered"
                  description="Run the backend initialisation to register the configured sources."
                  compact
                />
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[960px] text-left">
                  <thead>
                    <tr className="border-b border-line bg-[#FAFBFC] text-[10px] uppercase tracking-[0.06em] text-muted">
                      <th className="px-4 py-2.5 font-medium">Source</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">Processing status</th>
                      <th className="px-4 py-2.5 font-medium">Last success</th>
                      <th className="px-4 py-2.5 font-medium">Records</th>
                      <th className="px-4 py-2.5 font-medium">Latest run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {sourceRows.map((source) => (
                      <SourceRowView key={source.id} source={source} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="mt-4 grid gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <SectionTitle
                title="How a record moves through the pipeline"
                description="A single Python ETL codebase, invoked by CLI or the admin refresh endpoint"
              />
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Extract", "Requests + BeautifulSoup + public APIs"],
                  ["Validate", "Required fields, URL and coordinate checks"],
                  ["Transform", "Clean text, parse dates, classify, extract locations"],
                  ["Deduplicate", "Stable fingerprints; updates counted separately"],
                  ["Load", "PostgreSQL with source attribution and run logs"],
                ].map(([title, description], index) => (
                  <div key={title} className="rounded-md border border-line bg-[#FAFBFC] px-3 py-2.5">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-accent">
                      0{index + 1}
                    </p>
                    <p className="mt-1 text-[11.5px] font-medium text-ink">{title}</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted">{description}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-line px-4 py-3">
                <p className="text-[10.5px] leading-4 text-muted">
                  Rejected records are never silently discarded: each run stores fetched, inserted,
                  updated, duplicate and rejected counts. Collection logs expose the failure reason
                  when a source cannot be reached.
                </p>
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <SectionTitle
                title="Collection quality"
                description="Aggregated across the latest runs shown"
              />
              <dl className="space-y-2.5 px-4 pb-4 text-[11.5px]">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <dt className="text-muted">Duplicates skipped</dt>
                  <dd className="font-medium tabular-nums text-ink">
                    {formatNumber(summary.recent_duplicates)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <dt className="text-muted">Records rejected</dt>
                  <dd className="font-medium tabular-nums text-ink">
                    {formatNumber(summary.recent_rejected)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <dt className="text-muted">Runs considered</dt>
                  <dd className="font-medium tabular-nums text-ink">
                    {formatNumber(summary.runs_considered)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Last collection</dt>
                  <dd className="text-right text-[10.5px] text-ink">
                    {summary.last_run_at ? formatDateTime(summary.last_run_at) : "Not run"}
                  </dd>
                </div>
              </dl>
              <div className="border-t border-line px-4 py-3">
                <p className="text-[10.5px] leading-4 text-muted">
                  OpenStreetMap data is © OpenStreetMap contributors, available under ODbL. Weather
                  data is provided by Open-Meteo under CC BY 4.0. Traffic police notices are public
                  government notices collected only after a robots.txt check.
                </p>
              </div>
            </Card>
          </div>

          <Card className="mt-4 overflow-hidden">
            <SectionTitle
              title="Collection run log"
              description="Latest 25 pipeline attempts, including failures and rejected records"
              action={
                logs.loading ? (
                  <span className="text-[10.5px] text-muted">Loading…</span>
                ) : (
                  <span className="text-[10.5px] text-muted">
                    {logs.data?.items.length ?? 0} runs shown
                  </span>
                )
              }
            />
            {logs.loading && !logs.data ? (
              <TableSkeleton rows={5} />
            ) : logs.error && !logs.data ? (
              <div className="p-4">
                <ErrorState
                  title="Run log unavailable"
                  message={logs.error}
                  onRetry={logs.reload}
                />
              </div>
            ) : logRows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No collection runs yet"
                  description="Trigger a collection with an admin token. Each attempt will be recorded here."
                  compact
                />
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[1000px] text-left">
                  <thead>
                    <tr className="border-b border-line bg-[#FAFBFC] text-[10px] uppercase tracking-[0.06em] text-muted">
                      <th className="px-4 py-2.5 font-medium">Started</th>
                      <th className="px-4 py-2.5 font-medium">Source</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Fetched / new / updated</th>
                      <th className="px-4 py-2.5 font-medium">Duplicates / rejected</th>
                      <th className="px-4 py-2.5 font-medium">Duration</th>
                      <th className="px-4 py-2.5 font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {logRows.map((log) => (
                      <LogRow key={log.id} log={log} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!running) setModalOpen(false);
        }}
        title="Run data collection"
        description="Starts all configured collectors in the background. Some public services can take up to two minutes. This action requires the backend ADMIN_TOKEN."
      >
        <form onSubmit={runCollection}>
          <Field
            label="Admin token"
            htmlFor="admin-token"
            hint="Sent only with this request in the X-Admin-Token header. It is not stored by the browser."
          >
            <input
              id="admin-token"
              type="password"
              autoComplete="off"
              className={inputClass}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Enter admin token"
            />
          </Field>
          {refreshError && (
            <p className="mt-2 text-[11.5px] leading-4 text-[#B42318]">{refreshError}</p>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[10px] leading-4 text-muted">
              Collectors respect source availability and record failures instead of fabricating
              data.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={running}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={running}>
                Run
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
