export type Category =
  | "Accident"
  | "Road Closure"
  | "Construction"
  | "Traffic Diversion"
  | "Public Event"
  | "Parking Restriction"
  | "Other";

export type IncidentStatus = "active" | "upcoming" | "resolved" | "unknown";
export type Severity = "low" | "medium" | "high";
export type Origin = "live" | "demo";

export interface Incident {
  id: number;
  external_id: string | null;
  title: string;
  category: Category;
  status: IncidentStatus;
  severity: Severity;
  summary: string | null;
  description?: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: "locality" | "segment" | "unknown";
  start_time: string | null;
  end_time: string | null;
  published_at: string | null;
  last_updated_at: string | null;
  source_name: string | null;
  source_slug: string | null;
  source_type: string | null;
  source_url: string | null;
  origin: Origin;
  classification?: { method: string; confidence: number } | null;
  related?: Incident[];
}

export interface IncidentsResponse {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface MapIncidentsResponse {
  items: Incident[];
  total: number;
  returned: number;
  truncated: boolean;
  note: string;
}

export interface WeatherAlert {
  date: string;
  condition: string | null;
  precipitation_mm: number;
  probability: number;
  alert_level: "moderate" | "high";
  origin: Origin;
  source_name: string | null;
}

export interface CollectionLog {
  id: number;
  pipeline: string;
  source_id: number | null;
  source_name: string | null;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  status: string;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  duplicates: number;
  rejected: number;
  message: string | null;
}

export interface DatasetInfo {
  total: number;
  live: number;
  demo: number;
  demo_mode: boolean;
  last_data_update?: string | null;
  last_updated?: string | null;
  last_collection?: CollectionLog | null;
}

export interface DashboardResponse {
  generated_at: string;
  range_days: number;
  dataset: DatasetInfo;
  stats: {
    total_incidents: number;
    active_disruptions: number;
    upcoming_disruptions: number;
    resolved_incidents: number;
    road_closures: number;
    construction_notices: number;
    construction_active: number;
    construction_mapped: number;
    active_live: number;
    active_demo: number;
    road_closures_live: number;
    road_closures_demo: number;
    construction_live: number;
    construction_demo: number;
    weather_alerts: number;
    incidents_last_7_days: number;
    active_locations: number;
  };
  weather_alerts: WeatherAlert[];
  weather_outlook: {
    date: string;
    kind: "observed" | "forecast";
    condition: string | null;
    temperature_c: number | null;
    precipitation_mm: number;
    probability: number | null;
    origin: Origin;
    source_name: string | null;
  }[];
  timeline: { date: string; count: number }[];
  categories: { category: Category; count: number; active: number }[];
  locations: { location: string; count: number; active: number }[];
  recent_updates: Incident[];
  announcements: Incident[];
}

export interface TrafficAnalyticsResponse {
  generated_at: string;
  range_days: number;
  window: { from: string; to: string };
  totals: {
    incidents: number;
    live: number;
    demo: number;
    avg_per_week: number;
    peak_day: { date: string; count: number } | null;
    resolved_share: number;
    most_affected_location: string | null;
  };
  frequency: { available: boolean; series: { date: string; count: number }[] };
  weekly: { available: boolean; series: { week_start: string; label: string; count: number }[] };
  monthly: { available: boolean; series: { month: string; label: string; count: number }[] };
  categories: { available: boolean; series: { category: Category; count: number; share: number }[] };
  locations: { available: boolean; series: { location: string; count: number }[] };
  status_trend: {
    available: boolean;
    series: {
      week_start: string;
      label: string;
      active: number;
      resolved: number;
      upcoming: number;
      unknown: number;
      total: number;
    }[];
  };
  weather: {
    available: boolean;
    insufficient_data: boolean;
    matched_days: number;
    correlation: number | null;
    rainy_days: number;
    dry_days: number;
    avg_incidents_rainy: number | null;
    avg_incidents_dry: number | null;
    series: {
      date: string;
      incidents: number;
      precipitation_mm: number;
      temperature_c: number | null;
      condition: string | null;
      origin: Origin;
    }[];
    note: string;
  };
  weather_snapshot: {
    id: number;
    date: string;
    kind: string;
    temperature_c: number | null;
    precipitation_mm: number | null;
    precipitation_probability: number | null;
    condition: string | null;
    origin: Origin;
    source_name: string | null;
  }[];
}

export interface WebsiteAnalyticsResponse {
  generated_at: string;
  range_days: number;
  totals: {
    visits: number;
    page_views: number;
    searches: number;
    incident_views: number;
    route_checks: number;
    map_interactions: number;
    events: number;
  };
  top_pages: { path: string; views: number }[];
  top_searches: { query: string; count: number }[];
  top_incidents: { id: number; title: string; category?: Category; location_name?: string | null; views: number }[];
  feature_usage: { feature: string; event_type: string; count: number }[];
  timeline: { date: string; page_views: number; visits: number }[];
  available: boolean;
  privacy_note: string;
}

export interface SourceRow {
  id: number;
  slug: string;
  name: string;
  source_type: string;
  base_url: string | null;
  description: string | null;
  licence_note: string | null;
  is_active: boolean;
  record_count: number;
  weather_count: number;
  status: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  latest_run: CollectionLog | null;
  last_success_run: CollectionLog | null;
}

export interface SourcesResponse {
  sources: SourceRow[];
  summary: {
    total_records: number;
    live_records: number;
    demo_records: number;
    recent_rejected: number;
    recent_duplicates: number;
    last_run_at: string | null;
    runs_considered: number;
  };
}

export interface PipelineLogsResponse {
  items: CollectionLog[];
  status_counts: Record<string, number>;
}

export interface MetaResponse {
  categories: Category[];
  statuses: IncidentStatus[];
  locations: { name: string; count: number; active: number }[];
  suggested_locations: string[];
  dataset: DatasetInfo;
  coverage: {
    region: string;
    approximate_bounds: { north: number; south: number; west: number; east: number };
  };
  attribution: string;
}

export interface RoutePlace {
  query: string;
  display_name: string;
  latitude: number;
  longitude: number;
  geocode_source: string;
}

export interface RouteHazard extends Incident {
  distance_from_route_m: number;
  route_fraction: number;
  match_type: string;
}

export interface RouteAlternative {
  option_id: string;
  distance_m: number;
  duration_s: number;
  hazard_count: number;
  hazards: number[];
  recommended: boolean;
  geometry: [number, number][];
}

export interface RouteResponse {
  generated_at: string;
  origin: RoutePlace;
  destination: RoutePlace;
  route: { distance_m: number; duration_s: number; geometry: [number, number][] };
  disruptions: RouteHazard[];
  alternatives: RouteAlternative[];
  suggested_alternative: {
    option_id: string;
    distance_m: number;
    duration_s: number;
    hazard_count: number;
    geometry: [number, number][];
  } | null;
  message: string;
  context: {
    corridor_m: number;
    incidents_considered: number;
    statuses_considered: IncidentStatus[];
    unknown_lookback_days: number;
    dataset_origins: { live: number; demo: number };
    routing_engine: string;
    routing_note: string;
  };
  disclaimer: string;
}

export interface IncidentQuery {
  search?: string;
  category?: string;
  status?: string;
  location?: string;
  date_from?: string;
  date_to?: string;
  origin?: string;
  page?: number;
  page_size?: number;
  limit?: number;
}
