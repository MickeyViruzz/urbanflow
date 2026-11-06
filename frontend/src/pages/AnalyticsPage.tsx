import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { ChartCard, ChartLegend, ChartTooltip, axisStyle, gridStroke } from "../components/charts";
import {
  Card,
  ChartSkeleton,
  DemoNotice,
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
  CATEGORY_COLORS,
  STATUS_COLORS,
  formatDayLabel,
  formatNumber,
  formatShortDate,
} from "../lib/format";
import { useApiResource } from "../lib/useApi";
import { tickInterval, useIsNarrow } from "../lib/useChartLayout";

const RANGES = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "12 months", value: 365 },
];

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function correlationLabel(value: number | null): string {
  if (value === null) return "Not calculated";
  const strength =
    Math.abs(value) < 0.2 ? "Very weak" : Math.abs(value) < 0.4 ? "Weak" : Math.abs(value) < 0.6 ? "Moderate" : "Strong";
  const direction = value > 0.02 ? "positive" : value < -0.02 ? "negative" : "flat";
  return `${strength} ${direction} association`;
}

function AnalyticsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="px-4 py-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-2.5 w-28" />
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="p-4 xl:col-span-8">
          <Skeleton className="mb-3 h-3 w-40" />
          <div className="h-[300px]">
            <ChartSkeleton />
          </div>
        </Card>
        <Card className="p-4 xl:col-span-4">
          <Skeleton className="mb-3 h-3 w-28" />
          <div className="h-[300px]">
            <ChartSkeleton />
          </div>
        </Card>
      </div>
    </>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(90);
  const isNarrow = useIsNarrow();
  const analytics = useApiResource(() => api.getTrafficAnalytics(days), [days]);
  const data = analytics.data;

  const changeRange = (value: number) => {
    setDays(value);
    trackEvent("filter_apply", {
      metadata: { page: "analytics", range_days: value },
    });
  };

  const categories = (data?.categories.series ?? []).filter((item) => item.count > 0);
  const weather = data?.weather;
  const weatherReady = Boolean(
    weather?.available && !weather.insufficient_data && weather.series.length > 0,
  );
  const weatherIsDemo = weather?.series.some((item) => item.origin === "demo") ?? false;

  return (
    <>
      <PageHeader
        eyebrow="Analyse"
        title="Traffic analytics"
        description="Patterns derived from the incident and weather records stored in PostgreSQL. Charts show the selected time window only; no synthetic trends are drawn."
        actions={
          <SegmentedControl
            options={RANGES}
            value={days}
            onChange={changeRange}
            ariaLabel="Analytics date range"
          />
        }
      />

      {analytics.loading && <AnalyticsSkeleton />}

      {!analytics.loading && analytics.error && (
        <ErrorState
          title="Analytics unavailable"
          message={analytics.error}
          onRetry={analytics.reload}
        />
      )}

      {!analytics.loading && data && (
        <>
          {data.totals.demo > 0 && (
            <DemoNotice
              dataset={{
                demo: data.totals.demo,
                live: data.totals.live,
                total: data.totals.incidents,
              }}
            />
          )}

          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted">
              Window: {formatShortDate(`${data.window.from}T12:00:00+05:30`)} —{" "}
              {formatShortDate(`${data.window.to}T12:00:00+05:30`)}
            </p>
            <p className="text-[11px] text-muted">
              {formatNumber(data.totals.live)} live · {formatNumber(data.totals.demo)} demo records
              in this window
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <StatCard
              label="Incidents in range"
              value={formatNumber(data.totals.incidents)}
              meta="Recorded dates within the window"
              accent="#475467"
            />
            <StatCard
              label="Average per week"
              value={data.totals.avg_per_week.toFixed(1)}
              meta="Mean recorded incidents per 7 days"
              accent="#1570EF"
            />
            <StatCard
              label="Peak day"
              value={
                data.totals.peak_day ? formatShortDate(`${data.totals.peak_day.date}T12:00:00+05:30`) : "—"
              }
              meta={
                data.totals.peak_day
                  ? `${data.totals.peak_day.count} incidents recorded`
                  : "No incidents in range"
              }
              accent="#B54708"
            />
            <StatCard
              label="Most affected location"
              value={
                <span className="text-[18px] leading-7">
                  {data.totals.most_affected_location ?? "—"}
                </span>
              }
              meta="Most frequently named locality"
              accent="#7F56D9"
            />
            <StatCard
              label="Resolved share"
              value={`${data.totals.resolved_share.toFixed(1)}%`}
              meta={`${formatNumber(data.totals.incidents)} records in window`}
              accent="#067647"
              className="col-span-2 xl:col-span-1"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-12">
            <ChartCard
              title="Incident frequency over time"
              description="Daily incident counts by recorded date; OSM records use last-edit date"
              className="xl:col-span-8"
              height={300}
              available={data.frequency.available && data.frequency.series.some((item) => item.count > 0)}
              emptyTitle="No incidents in this window"
              emptyDescription="Widen the range or collect more data to see a frequency trend."
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.frequency.series}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    interval={tickInterval(data.frequency.series.length, isNarrow, 9, 4)}
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
                    fillOpacity={0.5}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: "#1D4ED8" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="xl:col-span-4">
              <SectionTitle
                title="Distribution of incident categories"
                description="Stored categories: model-classified notices and source-assigned records"
              />
              {categories.length === 0 ? (
                <div className="px-4 pb-4">
                  <EmptyState
                    title="No category data"
                    description="Run a collection to classify incident text."
                    compact
                  />
                </div>
              ) : (
                <>
                  <div className="relative h-[196px] px-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categories}
                          dataKey="count"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={82}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {categories.map((entry) => (
                            <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[21px] font-semibold tabular-nums text-ink">
                        {formatNumber(data.totals.incidents)}
                      </span>
                      <span className="text-[9.5px] uppercase tracking-[0.06em] text-muted">
                        incidents
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 pb-4">
                    {categories.map((entry) => (
                      <div key={entry.category} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-[#475467]">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[entry.category] }}
                          />
                          <span className="truncate">{entry.category}</span>
                        </span>
                        <span className="text-[10.5px] font-medium tabular-nums text-ink">
                          {entry.share.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            <ChartCard
              title="Most frequently affected locations"
              description="Top localities by incident count in this window"
              className="xl:col-span-4"
              height={300}
              available={data.locations.available && data.locations.series.length > 0}
              emptyTitle="No location data"
              emptyDescription="Location extraction did not find enough named places in these records."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.locations.series}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="location"
                    width={118}
                    tick={{ ...axisStyle, fontSize: 10.5 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: string) => truncate(value, 18)}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F5F6F8" }} />
                  <Bar dataKey="count" name="Incidents" fill="#1D4ED8" radius={[0, 4, 4, 0]} barSize={13}>
                    <LabelList
                      dataKey="count"
                      position="right"
                      style={{ fontSize: 10, fill: "#667085" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Weekly incident pattern"
              description="Incident counts grouped by ISO week start"
              className="xl:col-span-4"
              height={300}
              available={data.weekly.available && data.weekly.series.some((item) => item.count > 0)}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weekly.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    interval={tickInterval(data.weekly.series.length, isNarrow, 10, 4)}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F5F6F8" }} />
                  <Bar
                    dataKey="count"
                    name="Incidents"
                    fill="#1D4ED8"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Monthly incident trend"
              description="Incident totals by calendar month"
              className="xl:col-span-4"
              height={300}
              available={data.monthly.available && data.monthly.series.some((item) => item.count > 0)}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthly.series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Incidents"
                    stroke="#1D4ED8"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#1D4ED8", strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Weather conditions vs reported incidents"
              description="Daily precipitation compared with incident counts; forecast days excluded"
              className="xl:col-span-8"
              height={300}
              available={weatherReady}
              action={
                <ChartLegend
                  items={[
                    { label: "Precipitation (mm)", color: "#BAE6FD" },
                    { label: "Incidents", color: "#1D4ED8" },
                  ]}
                />
              }
              emptyTitle="Insufficient weather overlap"
              emptyDescription="At least ten days of matched weather observations and at least five incident records are required before comparing the two. This avoids drawing misleading conclusions from a small sample."
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={weather?.series ?? []}
                  margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    interval={tickInterval(weather?.series.length ?? 1, isNarrow, 8, 4)}
                    tickFormatter={(value: string) => formatDayLabel(value)}
                  />
                  <YAxis
                    yAxisId="precip"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                    tickFormatter={(value: number) => `${value}`}
                  />
                  <YAxis
                    yAxisId="incidents"
                    orientation="right"
                    allowDecimals={false}
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <Tooltip content={<ChartTooltip labelType="date" />} />
                  <Bar
                    yAxisId="precip"
                    dataKey="precipitation_mm"
                    name="Precipitation (mm)"
                    fill="#BAE6FD"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={8}
                  />
                  <Line
                    yAxisId="incidents"
                    type="monotone"
                    dataKey="incidents"
                    name="Incidents"
                    stroke="#1D4ED8"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="xl:col-span-4">
              <SectionTitle
                title="Weather association"
                description="A measured association, not a causal claim"
              />
              <div className="px-4 pb-4">
                {weather?.insufficient_data || !weather?.available ? (
                  <EmptyState
                    title="Insufficient weather/incident overlap"
                    description="The system needs at least ten days where both weather and incident records exist, plus at least five incident records in the window. Collected weather data is retained and used automatically when sufficient overlap exists."
                    compact
                  />
                ) : (
                  <>
                    <div className="rounded-md border border-line bg-[#FAFBFC] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                        Pearson correlation
                      </p>
                      <p className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.03em] text-ink">
                        {weather.correlation === null ? "—" : weather.correlation.toFixed(2)}
                      </p>
                      <p className="mt-1 text-[11.5px] text-[#475467]">
                        {correlationLabel(weather.correlation)}
                      </p>
                      <p className="mt-1 text-[10.5px] text-muted">
                        Based on {weather.matched_days} matched days
                      </p>
                    </div>
                    <dl className="mt-3 space-y-2 text-[11.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted">Rainy days (≥ 5 mm)</dt>
                        <dd className="font-medium text-ink">
                          {weather.rainy_days} days
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted">Average incidents, rainy days</dt>
                        <dd className="font-medium text-ink">
                          {weather.avg_incidents_rainy ?? "—"}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted">Average incidents, dry days</dt>
                        <dd className="font-medium text-ink">
                          {weather.avg_incidents_dry ?? "—"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-[10.5px] leading-4 text-muted">{weather.note}</p>
                  </>
                )}
                <p className="mt-3 text-[10px] text-muted">
                  Weather series:{" "}
                  <span className="font-medium text-[#475467]">
                    {!weather?.available
                      ? "no observations available"
                      : weatherIsDemo
                        ? "demonstration data"
                        : "live Open-Meteo data"}
                  </span>
                </p>
                <Link
                  to="/data-sources"
                  className="mt-2 inline-block text-[11px] font-medium text-accent hover:text-accent-dark"
                >
                  Weather source details →
                </Link>
              </div>
            </Card>

            <ChartCard
              title="Historical disruption trends"
              description="Weekly incidents grouped by their current recorded status"
              className="xl:col-span-12"
              height={280}
              available={data.status_trend.available && data.status_trend.series.some((item) => item.total > 0)}
              emptyTitle="No historical trend available"
              emptyDescription="Collect more incident records across several weeks to populate this trend."
              action={
                <ChartLegend
                  items={[
                    { label: "Active", color: STATUS_COLORS.active },
                    { label: "Upcoming", color: STATUS_COLORS.upcoming },
                    { label: "Resolved", color: STATUS_COLORS.resolved },
                    { label: "Unknown", color: STATUS_COLORS.unknown },
                  ]}
                />
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.status_trend.series}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    interval={tickInterval(data.status_trend.series.length, isNarrow, 10, 4)}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F5F6F8" }} />
                  <Bar dataKey="resolved" name="Resolved" stackId="status" fill={STATUS_COLORS.resolved} maxBarSize={24} />
                  <Bar dataKey="active" name="Active" stackId="status" fill={STATUS_COLORS.active} maxBarSize={24} />
                  <Bar
                    dataKey="upcoming"
                    name="Upcoming"
                    stackId="status"
                    fill={STATUS_COLORS.upcoming}
                    maxBarSize={24}
                  />
                  <Bar
                    dataKey="unknown"
                    name="Unknown"
                    stackId="status"
                    fill={STATUS_COLORS.unknown}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}
