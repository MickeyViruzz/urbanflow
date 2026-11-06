import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { CATEGORY_COLORS, STATUS_LABELS } from "../lib/format";
import type { Category, Incident, Severity } from "../lib/types";
import { cx } from "./ui";

export interface MapRoute {
  coordinates: [number, number][];
  color: string;
  weight?: number;
  dashed?: boolean;
}

interface TrafficMapProps {
  incidents: Pick<
    Incident,
    | "id"
    | "title"
    | "category"
    | "status"
    | "severity"
    | "location_name"
    | "latitude"
    | "longitude"
  >[];
  height?: number;
  onSelect?: (id: number) => void;
  routes?: MapRoute[];
  className?: string;
  showLegend?: boolean;
  interactive?: boolean;
  fitRoutes?: boolean;
}

const SEVERITY_RADIUS: Record<Severity, number> = { low: 5, medium: 6.5, high: 8.5 };

function RouteBounds({ routes }: { routes: MapRoute[] }) {
  const map = useMap();
  const signature = routes
    .map((route) => `${route.coordinates.length}:${route.coordinates[0]?.join(",")}`)
    .join("|");

  useEffect(() => {
    if (!routes.length) return;
    const points = routes.flatMap((route) => route.coordinates);
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points.map(([lat, lon]) => L.latLng(lat, lon)));
    map.fitBounds(bounds, { padding: [28, 28] });
    // The signature captures the route set without refitting on each parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);

  return null;
}

export function TrafficMap({
  incidents,
  height = 420,
  onSelect,
  routes = [],
  className,
  showLegend = true,
  interactive = true,
  fitRoutes = false,
}: TrafficMapProps) {
  const categories = useMemo(() => {
    const present = new Set<Category>();
    incidents.forEach((incident) => present.add(incident.category));
    return Array.from(present);
  }, [incidents]);

  const markers = incidents.filter(
    (incident) => incident.latitude !== null && incident.longitude !== null,
  );

  return (
    <div
      className={cx("relative overflow-hidden rounded-md border border-line", className)}
      style={{ height }}
    >
      <MapContainer
        center={[19.076, 72.8777]}
        zoom={11}
        scrollWheelZoom={interactive}
        dragging={interactive}
        style={{ height: "100%", width: "100%" }}
        attributionControl
        zoomControl={interactive}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        {fitRoutes && routes.length > 0 && <RouteBounds routes={routes} />}
        {routes.map((route, index) => (
          <Polyline
            key={`route-${index}`}
            positions={route.coordinates}
            pathOptions={{
              color: route.color,
              weight: route.weight ?? 5,
              opacity: 0.9,
              dashArray: route.dashed ? "8 8" : undefined,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ))}
        {markers.map((incident) => (
          <CircleMarker
            key={incident.id}
            center={[incident.latitude as number, incident.longitude as number]}
            radius={SEVERITY_RADIUS[incident.severity]}
            pathOptions={{
              color: "#FFFFFF",
              weight: 1.5,
              fillColor: CATEGORY_COLORS[incident.category],
              fillOpacity: 0.92,
            }}
            eventHandlers={
              onSelect
                ? {
                    click: () => onSelect(incident.id),
                  }
                : undefined
            }
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1} className="urbanflow-tooltip">
              <div className="max-w-[220px]">
                <p className="text-[11px] font-semibold leading-4 text-ink">{incident.title}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {incident.category} · {incident.location_name ?? "Location not reported"}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  Status: {STATUS_LABELS[incident.status]}
                </p>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {showLegend && categories.length > 0 && (
        <div className="pointer-events-none absolute bottom-8 left-3 z-[500] max-w-[calc(100%-24px)] rounded-md border border-line bg-white/95 px-3 py-2 shadow-card backdrop-blur-sm sm:bottom-3 sm:max-w-[calc(100%-80px)]">
          <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.07em] text-muted">
            Incident category
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {categories.map((category) => (
              <span
                key={category}
                className="flex items-center gap-1.5 text-[10.5px] leading-4 text-[#475467]"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[category] }}
                />
                {category}
              </span>
            ))}
          </div>
        </div>
      )}

      {markers.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center">
          <div className="rounded-md border border-line bg-white px-4 py-3 text-center shadow-card">
            <p className="text-[12px] font-medium text-ink">No mapped records match these filters</p>
            <p className="mt-0.5 text-[11px] text-muted">
              Try a wider date range or a different category.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
