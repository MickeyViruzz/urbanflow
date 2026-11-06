import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard, ChartTooltip, axisStyle, gridStroke } from "../components/charts";
import { IncidentDrawer } from "../components/IncidentDrawer";
import {
  Button,
  Card,
  CategoryBadge,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionTitle,
  SegmentedControl,
  Skeleton,
  StatCard,
} from "../components/ui";
import { api } from "../lib/api";
import { trackEvent } from "../lib/analytics";
import {
  PAGE_TITLES,
  formatDayLabel,
  formatNumber,
  relativeTime,
} from "../lib/format";
import { useApiResource } from "../lib/useApi";
import { tickInterval, useIsNarrow } from "../lib/useChartLayout";

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function pageLabel(path: string): string {
  const clean = path.split("?")[0];
  return PAGE_TITLES[clean] ?? clean;
}

export default function PlatformAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const isNarrow = useIsNarrow();
  const analytics = useApiResource(() => api.getWebsiteAnalytics(days), [days]);
  const data = analytics.data;

  const changeRange = (value: number) => {
    setDays(value);
    trackEvent("feature_use", { metadata: { feature: "platform_analytics_range", days: value } });
  };

  const maxPageViews = Math.max(1, ...(data?.top_pages.map((page) => page.views) ?? [1]));

  return (
    <>
      <PageHeader
        eyebrow="Analyse"
        title="Platform analytics"
        description="First-party usage analytics collected by UrbanFlow itself: visits, searches, map interactions and feature usage. No personal identifiers are collected."
        actions={
          <SegmentedControl
            options={RANGES}
            value={days}
            onChange={changeRange}
            ariaLabel="Platform analytics date range"
          />
        }
      />

      {analytics.loading && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="px-4 py-4">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="mt-3 h-7 w-14" />
                <Skeleton className="mt-2 h-2.5 w-28" />
              </Card>
            ))}
          </div>
          <Card className="mt-4 p-4">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-3 h-[260px] w-full" />
          </Card>
        </>
      )}

      {!analytics.loading && analytics.error && (
        <ErrorState
          title="Platform analytics unavailable"
          message={analytics.error}
          onRetry={analytics.reload}
        />
      )}

      {!analytics.loading && data && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <StatCard
              label="Visits"
              value={formatNumber(data.totals.visits)}
              meta="Unique hashed browser sessions"
              accent="#475467"
            />
            <StatCard
              label="Page views"
              value={formatNumber(data.totals.page_views)}
              meta={`Across ${days} days`}
              accent="#1D4ED8"
            />
            <StatCard
              label="Searches"
              value={formatNumber(data.totals.searches)}
              meta="Search submissions tracked"
              accent="#7F56D9"
            />
            <StatCard
              label="Route checks"
              value={formatNumber(data.totals.route_checks)}
              meta="Route disruption analyses run"
              accent="#0E9384"
            />
            <StatCard
              label="Incident views"
              value={formatNumber(data.totals.incident_views)}
              meta={`${formatNumber(data.totals.map_interactions)} map interactions`}
              accent="#B54708"
              className="col-span-2 xl:col-span-1"
            />
          </div>

          {!data.available ? (
            <Card className="mt-4 px-4 py-4">
              <EmptyState
                title="No analytics events in this range"
                description="Open a few pages, search for a location and run a route check. Events are recorded by this application's own API, without cookies or personal identifiers."
                action={
                  <Button variant="secondary" size="sm" onClick={() => analytics.reload()}>
                    Refresh
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-12">
              <ChartCard
                title="Page views over time"
                description="Daily page views and unique sessions"
                className="xl:col-span-8"
                height={280}
                available={true}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.timeline}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                      interval={tickInterval(data.timeline.length, isNarrow, 8, 4)}
                      tickFormatter={(value: string) => formatDayLabel(value)}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                    />
                    <Tooltip content={<ChartTooltip labelType="date" />} />
                    <Area
                      type="monotone"
                      dataKey="page_views"
                      name="Page views"
                      stroke="#1D4ED8"
                      strokeWidth={2}
                      fill="#DBEAFE"
                      fillOpacity={0.45}
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="visits"
                      name="Sessions"
                      stroke="#0E9384"
                      strokeWidth={1.5}
                      fill="#CCFBF1"
                      fillOpacity={0.25}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <Card className="overflow-hidden xl:col-span-4">
                <SectionTitle
                  title="Most visited pages"
                  description="Page views by route in this window"
                />
                {data.top_pages.length === 0 ? (
                  <div className="px-4 pb-4">
                    <EmptyState
                      title="No page views yet"
                      description="Navigate through the application to populate this report."
                      compact
                    />
                  </div>
                ) : (
                  <ul className="space-y-2.5 px-4 pb-4">
                    {data.top_pages.map((page) => (
                      <li key={page.path}>
                        <div className="flex items-center justify-between gap-2 text-[11.5px]">
                          <span className="truncate font-medium text-ink">
                            {pageLabel(page.path)}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted">{page.views}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.max(4, (page.views / maxPageViews) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-0.5 truncate text-[9.5px] text-[#98A2B3]">{page.path}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="xl:col-span-4">
                <SectionTitle
                  title="Frequently searched locations"
                  description="Normalised search terms aggregated across sessions in this window"
                />
                {data.top_searches.length === 0 ? (
                  <div className="px-4 pb-4">
                    <EmptyState
                      title="No searches recorded"
                      description="Search for a location on the disruptions page or check a route."
                      compact
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-line border-t border-line">
                    {data.top_searches.map((search) => (
                      <li
                        key={search.query}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <span className="truncate text-[12px] text-[#344054]">{search.query}</span>
                        <span className="shrink-0 rounded-full border border-line bg-[#FAFBFC] px-2 py-0.5 text-[10px] tabular-nums text-muted">
                          {search.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="xl:col-span-4">
                <SectionTitle
                  title="Feature usage distribution"
                  description="Events recorded by feature type"
                />
                <div className="h-[240px] px-4 pb-4">
                  {data.feature_usage.length === 0 ? (
                    <EmptyState
                      title="No feature events"
                      description="Use the map, route checker and search to generate feature usage."
                      compact
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.feature_usage}
                        layout="vertical"
                        margin={{ top: 0, right: 26, left: 0, bottom: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="feature"
                          width={122}
                          tick={{ ...axisStyle, fontSize: 10.5 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value: string) =>
                            value.length > 20 ? `${value.slice(0, 19)}…` : value
                          }
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F5F6F8" }} />
                        <Bar
                          dataKey="count"
                          name="Events"
                          fill="#1D4ED8"
                          radius={[0, 4, 4, 0]}
                          barSize={12}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <Card className="overflow-hidden xl:col-span-4">
                <SectionTitle
                  title="Most viewed incidents"
                  description="Detail views recorded by this application"
                />
                {data.top_incidents.length === 0 ? (
                  <div className="px-4 pb-4">
                    <EmptyState
                      title="No incident views"
                      description="Open an incident record from the dashboard, map or table."
                      compact
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-line border-t border-line">
                    {data.top_incidents.map((incident) => (
                      <li key={incident.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(incident.id)}
                          className="w-full px-4 py-2.5 text-left transition-colors hover:bg-[#FAFBFC]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[12px] font-medium leading-4 text-ink">
                              {incident.title}
                            </p>
                            <span className="shrink-0 text-[10.5px] tabular-nums text-muted">
                              {incident.views} views
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            {incident.category && (
                              <CategoryBadge category={incident.category} />
                            )}
                            <span className="text-[10px] text-muted">
                              {incident.location_name ?? "Location not reported"}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="xl:col-span-12">
                <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[12px] font-medium text-ink">Privacy note</p>
                    <p className="mt-0.5 max-w-3xl text-[11px] leading-5 text-muted">
                      {data.privacy_note}
                    </p>
                  </div>
                  <p className="shrink-0 text-[10.5px] text-muted">
                    {formatNumber(data.totals.events)} events · generated{" "}
                    {relativeTime(data.generated_at)}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <IncidentDrawer
        incidentId={selectedId}
        onClose={() => setSelectedId(null)}
        onSelect={setSelectedId}
      />
    </>
  );
}
