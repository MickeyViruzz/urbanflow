import { useState, type FormEvent } from "react";
import { ArrowLeftRight, Route as RouteIcon } from "lucide-react";
import { IncidentDrawer } from "../components/IncidentDrawer";
import { TrafficMap, type MapRoute } from "../components/TrafficMap";
import {
  Button,
  Card,
  CategoryBadge,
  EmptyState,
  ErrorState,
  Field,
  OriginBadge,
  PageHeader,
  SectionTitle,
  Spinner,
  StatusBadge,
  inputClass,
} from "../components/ui";
import { api, ApiError } from "../lib/api";
import { trackEvent } from "../lib/analytics";
import {
  formatDistance,
  formatDuration,
  formatNumber,
} from "../lib/format";
import type { RouteResponse } from "../lib/types";
import { useApiResource } from "../lib/useApi";

const QUICK_ROUTES: [string, string][] = [
  ["Bandra West", "Andheri West"],
  ["Colaba", "Powai"],
  ["Dadar", "Bandra-Kurla Complex"],
  ["Borivali", "Andheri East"],
];

export default function RouteCheckerPage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const meta = useApiResource(() => api.getMeta(), []);

  const performCheck = async (trimmedOrigin: string, trimmedDestination: string) => {
    setValidationError(null);
    setRequestError(null);
    setLoading(true);
    setResult(null);
    trackEvent("search", {
      metadata: { query: `${trimmedOrigin} to ${trimmedDestination}`, scope: "route" },
    });
    try {
      const response = await api.checkRoute(trimmedOrigin, trimmedDestination);
      setResult(response);
      trackEvent("route_check", {
        metadata: {
          origin: trimmedOrigin,
          destination: trimmedDestination,
          disruptions: response.disruptions.length,
          corridor_m: response.context.corridor_m,
        },
      });
    } catch (error) {
      setRequestError(
        error instanceof ApiError ? error.message : "The route check could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedOrigin = origin.trim();
    const trimmedDestination = destination.trim();
    if (trimmedOrigin.length < 2 || trimmedDestination.length < 2) {
      setValidationError("Enter both a starting location and a destination.");
      return;
    }
    if (trimmedOrigin.toLowerCase() === trimmedDestination.toLowerCase()) {
      setValidationError("The starting location and destination must be different.");
      return;
    }
    void performCheck(trimmedOrigin, trimmedDestination);
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    setValidationError(null);
  };

  const useQuickRoute = (from: string, to: string) => {
    setOrigin(from);
    setDestination(to);
    setValidationError(null);
  };

  const mapRoutes: MapRoute[] = result
    ? [
        {
          coordinates: result.route.geometry,
          color: "#1D4ED8",
          weight: 5,
        },
        ...(result.suggested_alternative
          ? [
              {
                coordinates: result.suggested_alternative.geometry,
                color: "#067647",
                weight: 4,
                dashed: true,
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Route disruption checker"
        description="Compare a calculated Mumbai route with the disruptions UrbanFlow has collected. Incident checks use a geographic corridor around the route, not live traffic feeds."
      />

      <Card className="mb-4 px-4 py-4">
        <form onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
            <Field label="Starting location" htmlFor="route-origin">
              <input
                id="route-origin"
                className={inputClass}
                placeholder="e.g. Bandra West"
                list="route-location-options"
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <div className="hidden pb-1 md:block">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 w-9 px-0"
                onClick={swap}
                aria-label="Swap starting location and destination"
                title="Swap locations"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Field label="Destination" htmlFor="route-destination">
              <input
                id="route-destination"
                className={inputClass}
                placeholder="e.g. Andheri West"
                list="route-location-options"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Button type="submit" loading={loading} className="h-9">
              Check route
            </Button>
          </div>
          <datalist id="route-location-options">
            {(meta.data?.suggested_locations ?? []).map((location) => (
              <option key={location} value={location} />
            ))}
          </datalist>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="md:hidden"
                onClick={swap}
                aria-label="Swap starting location and destination"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Swap
              </Button>
              <span className="mr-1 text-[10.5px] uppercase tracking-[0.05em] text-muted">
                Try
              </span>
              {QUICK_ROUTES.map(([from, to]) => (
                <button
                  key={`${from}-${to}`}
                  type="button"
                  onClick={() => useQuickRoute(from, to)}
                  className="rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] text-[#475467] transition-colors hover:border-[#B2DDFF] hover:bg-[#F5F8FF] hover:text-accent"
                >
                  {from} → {to}
                </button>
              ))}
            </div>
            <p className="text-[10.5px] text-muted">
              Coverage: Mumbai region. Route calculated by OSRM.
            </p>
          </div>
          {validationError && (
            <p className="mt-2 text-[11.5px] text-[#B42318]">{validationError}</p>
          )}
        </form>
      </Card>

      {loading && (
        <Card className="flex items-center gap-3 px-5 py-6">
          <Spinner />
          <div>
            <p className="text-[13px] font-medium text-ink">Analysing the route corridor…</p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Geocoding both locations, requesting a route from OSRM and matching active incident
              coordinates within the corridor.
            </p>
          </div>
        </Card>
      )}

      {!loading && requestError && (
        <ErrorState
          title="Route check failed"
          message={requestError}
          onRetry={() => {
            void performCheck(origin.trim(), destination.trim());
          }}
        />
      )}

      {!loading && result && (
        <div className="space-y-4" aria-live="polite">
          <div
            className={`rounded-card border px-4 py-3.5 ${
              result.disruptions.length > 0
                ? "border-[#FEDF89] bg-[#FFFCF5]"
                : "border-[#B2DDFF] bg-[#F5F8FF]"
            }`}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[12.5px] font-semibold text-ink">
                  {result.disruptions.length > 0
                    ? `${result.disruptions.length} reported disruption${
                        result.disruptions.length === 1 ? "" : "s"
                      } near this route`
                    : "No matching disruption found in the collected dataset"}
                </p>
                <p className="mt-1 max-w-3xl text-[11.5px] leading-5 text-[#475467]">
                  {result.message}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.05em] text-muted">
                Corridor {result.context.corridor_m} m
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-card border border-line bg-white px-4 py-3.5 shadow-card">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">
                Route distance
              </p>
              <p className="mt-1.5 text-[21px] font-semibold tabular-nums text-ink">
                {formatDistance(result.route.distance_m)}
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted">Calculated road network distance</p>
            </div>
            <div className="rounded-card border border-line bg-white px-4 py-3.5 shadow-card">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">
                OSRM duration estimate
              </p>
              <p className="mt-1.5 text-[21px] font-semibold tabular-nums text-ink">
                {formatDuration(result.route.duration_s)}
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted">Free-flow estimate, not live traffic</p>
            </div>
            <div className="rounded-card border border-line bg-white px-4 py-3.5 shadow-card">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">
                Incidents near route
              </p>
              <p className="mt-1.5 text-[21px] font-semibold tabular-nums text-ink">
                {formatNumber(result.disruptions.length)}
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Within {result.context.corridor_m} m of the travel corridor
              </p>
            </div>
            <div className="rounded-card border border-line bg-white px-4 py-3.5 shadow-card">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">
                Records considered
              </p>
              <p className="mt-1.5 text-[21px] font-semibold tabular-nums text-ink">
                {formatNumber(result.context.incidents_considered)}
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {formatNumber(result.context.dataset_origins.live)} live ·{" "}
                {formatNumber(result.context.dataset_origins.demo)} demo
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <TrafficMap
                incidents={result.disruptions}
                routes={mapRoutes}
                height={430}
                fitRoutes
                onSelect={setSelectedId}
              />
              <div className="mt-2 flex flex-col gap-1 text-[10.5px] leading-4 text-muted sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <span className="font-medium text-[#344054]">Solid blue</span>: calculated route ·{" "}
                  <span className="font-medium text-[#067647]">dashed green</span>: suggested
                  alternative (if returned) · markers: reported disruptions.
                </p>
                <p className="shrink-0">
                  {result.origin.geocode_source === "gazetteer" ? "Locality lookup" : "Nominatim"} ·{" "}
                  {result.context.routing_engine}
                </p>
              </div>
            </div>

            <div className="space-y-4 xl:col-span-4">
              <Card>
                <SectionTitle title="Route endpoints" description="Resolved by the geocoder" />
                <dl className="px-4 pb-4 text-[11.5px]">
                  <div className="border-b border-line pb-2.5">
                    <dt className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted">
                      From
                    </dt>
                    <dd className="mt-1 leading-5 text-ink">{result.origin.display_name}</dd>
                  </div>
                  <div className="pt-2.5">
                    <dt className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted">
                      To
                    </dt>
                    <dd className="mt-1 leading-5 text-ink">{result.destination.display_name}</dd>
                  </div>
                </dl>
              </Card>

              {result.suggested_alternative ? (
                <Card className="border-[#ABEFC6]">
                  <div className="px-4 pb-4 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#067647]">
                        Suggested alternative
                      </p>
                      <span className="rounded-full border border-[#ABEFC6] bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-medium text-[#067647]">
                        Fewer recorded hazards
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className="text-[20px] font-semibold tabular-nums text-ink">
                        {formatDistance(result.suggested_alternative.distance_m)}
                      </span>
                      <span className="text-[11.5px] text-muted">
                        {formatDuration(result.suggested_alternative.duration_s)} estimate
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-5 text-[#475467]">
                      OSRM returned this route as an alternative, with{" "}
                      {result.suggested_alternative.hazard_count} recorded disruption
                      {result.suggested_alternative.hazard_count === 1 ? "" : "s"} within the
                      corridor — fewer than the primary route.
                    </p>
                    <p className="mt-2 rounded border border-line bg-[#FAFBFC] px-2.5 py-2 text-[10.5px] leading-4 text-muted">
                      This is a routing-engine suggestion based on stored incident locations. It is
                      not an official diversion or a guarantee of faster travel.
                    </p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Suggested alternative
                    </p>
                    <p className="mt-2 text-[11.5px] leading-5 text-[#475467]">
                      {result.alternatives.length > 0
                        ? `The routing service returned ${result.alternatives.length} alternative route${
                            result.alternatives.length === 1 ? "" : "s"
                          }, but none had fewer recorded disruptions than the primary route.`
                        : "The routing service did not return an alternative route for this trip. No alternative is shown rather than inventing one."}
                    </p>
                  </div>
                </Card>
              )}

              <Card>
                <SectionTitle
                  title="Method & limits"
                  description="How this result was produced"
                />
                <div className="px-4 pb-4">
                  <p className="text-[11px] leading-5 text-[#475467]">
                    {result.context.routing_note}
                  </p>
                  <dl className="mt-3 space-y-1 border-t border-line pt-2 text-[10.5px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Route corridor</dt>
                      <dd className="font-medium text-[#475467]">
                        {result.context.corridor_m} m
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Statuses considered</dt>
                      <dd className="text-right font-medium capitalize text-[#475467]">
                        {result.context.statuses_considered.join(", ")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">OSM recency window</dt>
                      <dd className="font-medium text-[#475467]">
                        {result.context.unknown_lookback_days} days
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[11px] leading-5 text-muted">{result.disclaimer}</p>
                </div>
              </Card>
            </div>
          </div>

          <Card className="overflow-hidden">
            <SectionTitle
              title="Reported disruptions near the route"
              description={`Records with coordinates within ${result.context.corridor_m} m of the primary route`}
            />
            {result.disruptions.length === 0 ? (
              <div className="px-4 pb-4">
                <EmptyState
                  title="No disruption matched this corridor"
                  description="This does not confirm that the route is clear. Only records already collected by UrbanFlow were checked; official advisories may be missing, delayed or not yet collected."
                />
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-line bg-[#FAFBFC] text-[10px] uppercase tracking-[0.06em] text-muted">
                      <th className="px-4 py-2.5 font-medium">Incident</th>
                      <th className="px-4 py-2.5 font-medium">Category</th>
                      <th className="px-4 py-2.5 font-medium">Location</th>
                      <th className="px-4 py-2.5 font-medium">Distance from route</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {result.disruptions.map((incident) => (
                      <tr
                        key={incident.id}
                        onClick={() => setSelectedId(incident.id)}
                        className="cursor-pointer align-top transition-colors hover:bg-[#FAFBFC]"
                      >
                        <td className="max-w-[300px] px-4 py-3">
                          <button
                            type="button"
                            className="text-left text-[12px] font-medium leading-4 text-ink hover:text-accent"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(incident.id);
                            }}
                          >
                            {incident.title}
                          </button>
                          <div className="mt-1 flex items-center gap-1.5">
                            <OriginBadge origin={incident.origin} />
                            {incident.location_precision === "locality" && (
                              <span className="text-[9.5px] text-[#98A2B3]">
                                approximate locality
                              </span>
                            )}
                            {incident.location_precision === "segment" && (
                              <span className="text-[9.5px] text-[#98A2B3]">
                                OSM segment centre
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <CategoryBadge category={incident.category} />
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#475467]">
                          {incident.location_name ?? "Not reported"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[11px] tabular-nums text-[#475467]">
                          {formatDistance(incident.distance_from_route_m)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={incident.status} />
                        </td>
                        <td className="max-w-[160px] px-4 py-3 text-[10.5px] text-[#475467]">
                          <span className="line-clamp-2">{incident.source_name}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="flex items-center gap-1.5 text-[10.5px] leading-4 text-muted">
            <RouteIcon className="h-3 w-3" />
            Route geometry from OSRM. UrbanFlow does not integrate a live traffic-speed provider;
            no fastest-route guarantee is made.
          </p>
        </div>
      )}

      {!loading && !result && !requestError && (
        <Card className="px-4 py-4">
          <SectionTitle
            title="How the corridor check works"
            description="Mumbai coverage only"
          />
          <div className="grid gap-4 px-4 pb-4 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-accent">
                01 · Geocode
              </p>
              <p className="mt-1.5 text-[11.5px] leading-5 text-[#475467]">
                Both locations are resolved against a curated Mumbai gazetteer, with Nominatim as a
                fallback for other Mumbai addresses.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-accent">
                02 · Route
              </p>
              <p className="mt-1.5 text-[11.5px] leading-5 text-[#475467]">
                OSRM returns a drivable route geometry, distance and a free-flow duration estimate.
                No live speed data is implied.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-accent">
                03 · Match
              </p>
              <p className="mt-1.5 text-[11.5px] leading-5 text-[#475467]">
                Active, upcoming and status-unknown mapped records within 350 m of the route
                corridor are reported. A missing match never means the road is clear.
              </p>
            </div>
          </div>
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
