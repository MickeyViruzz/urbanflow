import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, ChartCard, axisStyle, gridStroke } from "../components/charts";
import { IncidentDrawer } from "../components/IncidentDrawer";
import { TrafficMap } from "../components/TrafficMap";
import {
  ButtonLink,
  Card,
  CategoryBadge,
  DemoNotice,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionTitle,
  Skeleton,
  StatCard,
  StatusBadge,
  ChartSkeleton,
} from "../components/ui";
import { api } from "../lib/api";
import { trackEvent } from "../lib/analytics";
import {
  CATEGORY_COLORS,
  formatDayLabel,
  formatNumber,
  formatShortDate,
  relativeTime,
} from "../lib/format";
import type { Incident } from "../lib/types";
import { useApiResource } from "../lib/useApi";
import { tickInterval, useIsNarrow } from "../lib/useChartLayout";

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function OverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="px-4 py-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-2.5 w-32" />
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="p-4 xl:col-span-8">
          <Skeleton className="mb-3 h-3 w-32" />
          <Skeleton className="h-[330px] w-full" />
        </Card>
        <Card className="p-4 xl:col-span-4">
          <Skeleton className="mb-3 h-3 w-28" />
          <Skeleton className="h-[330px] w-full" />
        </Card>
        <Card className="p-4 xl:col-span-8">
          <Skeleton className="mb-3 h-3 w-36" />
          <div className="h-[260px]">
            <ChartSkeleton />
          </div>
        </Card>
        <Card className="p-4 xl:col-span-4">
          <Skeleton className="mb-3 h-3 w-36" />
          <div className="h-[260px]">
            <ChartSkeleton />
          </div>
        </Card>
      </div>
    </>
  );
}

export default function OverviewPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const isNarrow = useIsNarrow();
  const dashboard = useApiResource(() => api.getDashboard(30), []);
  const mapIncidents = useApiResource(() => api.getMapIncidents({ limit: 500 }), []);

  const handleMarkerOpen = (id: number) => {
    trackEvent("map_interaction", { metadata: { action: "marker_open", incident_id: id } });
    setSelectedId(id);
  };

  const openIncident = (incident: Incident | number) => {
    setSelectedId(typeof incident === "number" ? incident : incident.id);
  };

  const data = dashboard.data;
  const total = data?.stats.total_incidents ?? 0;
  const timeline = data?.timeline ?? [];
  const categories = (data?.categories ?? []).filter((category) => category.count > 0);

  return (
    <>
      <PageHeader
        eyebrow="Mumbai · Overview"
        title="Traffic overview"
        description="A consolidated view of road disruptions, construction activity and weather risk derived from collected records."
        actions={
          <>
            <ButtonLink to="/map" variant="secondary">
              Open traffic map
            </ButtonLink>
            <ButtonLink to="/route-check">Check a route</ButtonLink>
          </>
        }
      />

      {dashboard.loading && <OverviewSkeleton />}

      {!dashboard.loading && dashboard.error && (
        <ErrorState
          title="Dashboard unavailable"
          message={dashboard.error}
          onRetry={dashboard.reload}
        />
      )}

      {!dashboard.loading && data && (
        <>
          <DemoNotice dataset={data.dataset} />

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <StatCard
              label="Total incidents"
              value={formatNumber(data.stats.total_incidents)}
              meta={`${formatNumber(data.stats.incidents_last_7_days)} records dated in the last 7 days`}
              accent="#475467"
            />
            <StatCard
              label="Active disruptions"
              value={formatNumber(data.stats.active_disruptions)}
              meta={`${data.stats.active_live} live · ${data.stats.active_demo} demo active`}
              accent="#B42318"
            />
            <StatCard
              label="Road closures"
              value={formatNumber(data.stats.road_closures)}
              meta={`${data.stats.road_closures_live} live · ${data.stats.road_closures_demo} demo active`}
              accent="#C4320A"
            />
            <StatCard
              label="Construction activity"
              value={formatNumber(data.stats.construction_notices)}
              meta={`${formatNumber(data.stats.construction_live)} live-mapped · ${formatNumber(
                data.stats.construction_demo,
              )} demo`}
              accent="#7F56D9"
            />
            <StatCard
              label="Weather alerts"
              value={formatNumber(data.stats.weather_alerts)}
              meta={
                data.stats.weather_alerts
                  ? data.weather_alerts.some((alert) => alert.origin === "demo")
                    ? "Sample forecast alerts (demo data)"
                    : "Live forecast risk in the forecast window"
                  : data.weather_outlook.length > 0
                    ? "No forecast alerts right now"
                    : "No weather observations collected"
              }
              accent="#1570EF"
              className="col-span-2 xl:col-span-1"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-12">
            <Card className="overflow-hidden xl:col-span-8">
              <SectionTitle
                title="Disruption map"
                description="Recorded disruptions with available coordinates across Mumbai"
                action={
                  <Link
                    to="/map"
                    className="text-[11.5px] font-medium text-accent hover:text-accent-dark"
                  >
                    Open map →
                  </Link>
                }
              />
              <div className="px-4 pb-3">
                {mapIncidents.loading ? (
                  <Skeleton className="h-[330px] w-full" />
                ) : mapIncidents.error ? (
                  <ErrorState
                    title="Map unavailable"
                    message={mapIncidents.error}
                    onRetry={mapIncidents.reload}
                  />
                ) : (
                  <TrafficMap
                    incidents={mapIncidents.data?.items ?? []}
                    height={330}
                    onSelect={handleMarkerOpen}
                  />
                )}
                <p className="mt-2 text-[10.5px] leading-4 text-muted">
                  Marker positions are locality centroids or OpenStreetMap road-segment centres.
                  OSM records carry an unconfirmed status. Click a marker to open its record.
                </p>
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <SectionTitle
                title="Incident mix"
                description="Share of all collected records by category"
              />
              {categories.length === 0 ? (
                <div className="px-4 pb-4">
                  <EmptyState
                    title="No categorised records"
                    description="Run a data collection to populate the incident mix."
                    compact
                  />
                </div>
              ) : (
                <>
                  <div className="relative h-[172px] px-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categories}
                          dataKey="count"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {categories.map((entry) => (
                            <Cell
                              key={entry.category}
                              fill={CATEGORY_COLORS[entry.category]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[20px] font-semibold tabular-nums text-ink">
                        {formatNumber(total)}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.06em] text-muted">
                        records
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 pb-4">
                    {categories.map((entry) => (
                      <div key={entry.category} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#475467]">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[entry.category] }}
                          />
                          <span className="truncate">{entry.category}</span>
                        </span>
                        <span className="text-[11px] font-medium tabular-nums text-ink">
                          {entry.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            <ChartCard
              title="Reported incidents over time"
              description="Daily recorded dates; OSM mapped records use the OSM last-edit date"
              className="xl:col-span-8"
              height={260}
              available={timeline.some((item) => item.count > 0)}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    interval={tickInterval(timeline.length, isNarrow, 8, 4)}
                    tickFormatter={(value: string) => formatDayLabel(value)}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    content={<ChartTooltip labelType="date" />}
                    cursor={{ stroke: "#D0D5DD", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Incidents"
                    stroke="#1D4ED8"
                    strokeWidth={2}
                    fill="#DBEAFE"
                    fillOpacity={0.55}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: "#1D4ED8" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Frequently affected locations"
              description="Locations with the most recorded incidents"
              className="xl:col-span-4"
              height={260}
              available={(data.locations?.length ?? 0) > 0}
              emptyTitle="No location data"
              emptyDescription="Location extraction did not find enough named places in the collected records."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.locations}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="location"
                    width={112}
                    tick={{ ...axisStyle, fontSize: 10.5 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: string) => truncate(value, 17)}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F5F6F8" }} />
                  <Bar dataKey="count" name="Incidents" fill="#1D4ED8" radius={[0, 4, 4, 0]} barSize={14}>
                    <LabelList
                      dataKey="count"
                      position="right"
                      style={{ fontSize: 10, fill: "#667085" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-12">
            <Card className="overflow-hidden xl:col-span-7">
              <SectionTitle
                title="Recently updated incidents"
                description="Latest changes across the collected dataset"
                action={
                  <Link
                    to="/disruptions"
                    className="text-[11.5px] font-medium text-accent hover:text-accent-dark"
                  >
                    All records →
                  </Link>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left">
                  <thead>
                    <tr className="border-y border-line bg-[#FAFBFC] text-[10px] uppercase tracking-[0.06em] text-muted">
                      <th className="w-auto px-4 py-2 font-medium">Incident</th>
                      <th className="w-[104px] px-4 py-2 font-medium">Status</th>
                      <th className="hidden w-[100px] px-4 py-2 font-medium sm:table-cell">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.recent_updates.map((incident) => (
                      <tr
                        key={incident.id}
                        className="cursor-pointer transition-colors hover:bg-[#FAFBFC]"
                        onClick={() => openIncident(incident)}
                      >
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openIncident(incident);
                            }}
                            className="block w-full truncate text-left text-[12.5px] font-medium text-ink hover:text-accent"
                          >
                            {incident.title}
                          </button>
                          <span className="mt-0.5 block truncate text-[10.5px] text-muted">
                            {incident.category} · {incident.location_name ?? "Location not reported"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={incident.status} />
                        </td>
                        <td className="hidden px-4 py-2.5 text-[11px] text-muted sm:table-cell">
                          {relativeTime(incident.last_updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recent_updates.length === 0 && (
                  <div className="p-4">
                    <EmptyState
                      title="No incidents recorded"
                      description="Use the data pipeline to run a collection."
                      compact
                    />
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden xl:col-span-5">
                <SectionTitle
                  title="Recent traffic announcements"
                  description="Newest active or upcoming notices"
                  action={
                    <Link
                      to="/disruptions"
                      className="text-[11.5px] font-medium text-accent hover:text-accent-dark"
                    >
                      View all →
                    </Link>
                  }
                />
                <ul className="divide-y divide-line border-t border-line">
                  {data.announcements.map((incident) => (
                    <li key={incident.id}>
                      <button
                        type="button"
                        onClick={() => openIncident(incident)}
                        className="w-full px-4 py-2.5 text-left transition-colors hover:bg-[#FAFBFC]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <CategoryBadge category={incident.category} />
                          <span className="shrink-0 text-[10px] text-muted">
                            {formatShortDate(incident.published_at)}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-[12px] font-medium leading-4 text-ink">
                          {incident.title}
                        </p>
                        <p className="mt-0.5 truncate text-[10.5px] text-muted">
                          {incident.location_name ?? "Location not reported"} ·{" "}
                          {incident.source_name ?? "Source unavailable"}
                        </p>
                      </button>
                    </li>
                  ))}
                  {data.announcements.length === 0 && (
                    <li className="p-4">
                      <EmptyState
                        title="No announcements"
                        description="No active or upcoming records are currently available."
                        compact
                      />
                    </li>
                  )}
                </ul>
            </Card>
          </div>
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
