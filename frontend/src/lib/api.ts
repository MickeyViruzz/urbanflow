import type {
  DashboardResponse,
  Incident,
  IncidentQuery,
  IncidentsResponse,
  MapIncidentsResponse,
  MetaResponse,
  PipelineLogsResponse,
  RouteResponse,
  SourcesResponse,
  TrafficAnalyticsResponse,
  WebsiteAnalyticsResponse,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function detailToMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return String(item);
      })
      .join(" ");
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return "The request could not be completed.";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 30000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) {
      let message = `Request failed with status ${response.status}.`;
      try {
        const body = await response.json();
        message = detailToMessage(body?.detail) || message;
      } catch {
        // Keep the status-based message when the error body is not JSON.
      }
      throw new ApiError(message, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The request timed out. Check that the API is running and try again.", 0);
    }
    throw new ApiError(
      "Could not reach the UrbanFlow API. Check that the backend is running.",
      0,
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
  getDashboard: (days = 30) =>
    request<DashboardResponse>(`/api/dashboard${buildQuery({ days })}`),
  getMeta: () => request<MetaResponse>("/api/meta"),
  getIncidents: (params: IncidentQuery) =>
    request<IncidentsResponse>(`/api/incidents${buildQuery({ ...params })}`),
  getMapIncidents: (params: IncidentQuery) =>
    request<MapIncidentsResponse>(`/api/incidents/map${buildQuery({ ...params })}`),
  getIncident: (id: number) => request<Incident>(`/api/incidents/${id}`),
  getTrafficAnalytics: (days: number) =>
    request<TrafficAnalyticsResponse>(`/api/analytics/traffic${buildQuery({ days })}`),
  getWebsiteAnalytics: (days: number) =>
    request<WebsiteAnalyticsResponse>(`/api/analytics/website${buildQuery({ days })}`),
  getSources: () => request<SourcesResponse>("/api/sources"),
  getPipelineLogs: (limit = 25) =>
    request<PipelineLogsResponse>(`/api/pipeline/logs${buildQuery({ limit })}`),
  runPipeline: (token: string) =>
    request<{ status: string; message: string }>("/api/pipeline/run", {
      method: "POST",
      headers: { "X-Admin-Token": token },
      body: JSON.stringify({ sources: ["all"] }),
    }),
  checkRoute: (origin: string, destination: string) =>
    request<RouteResponse>(
      "/api/route/check",
      {
        method: "POST",
        body: JSON.stringify({ origin, destination }),
      },
      60000,
    ),
};
