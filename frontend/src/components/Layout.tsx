import {
  BarChart3,
  Database,
  Info,
  LayoutDashboard,
  Map,
  Menu,
  MousePointerClick,
  Route,
  Table2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { PAGE_TITLES, relativeTime } from "../lib/format";
import type { MetaResponse } from "../lib/types";
import { cx } from "./ui";

const navigation = [
  {
    label: "Monitor",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/map", label: "Traffic map", icon: Map },
      { to: "/disruptions", label: "Road disruptions", icon: Table2 },
    ],
  },
  {
    label: "Analyse",
    items: [
      { to: "/analytics", label: "Traffic analytics", icon: BarChart3 },
      { to: "/platform-analytics", label: "Platform analytics", icon: MousePointerClick },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/route-check", label: "Route checker", icon: Route },
      { to: "/data-sources", label: "Data pipeline", icon: Database },
    ],
  },
  {
    label: "Project",
    items: [{ to: "/about", label: "About", icon: Info }],
  },
];

function BrandMark() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-ink" aria-hidden="true">
      <div className="flex items-end gap-[2px]">
        <span className="h-2 w-[3px] rounded-full bg-white/80" />
        <span className="h-3.5 w-[3px] rounded-full bg-white" />
        <span className="h-2.5 w-[3px] rounded-full bg-[#8FB3FF]" />
      </div>
    </div>
  );
}

function SidebarContent({ meta, onNavigate }: { meta: MetaResponse | null; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 border-b border-line px-5 py-[15px]"
      >
        <BrandMark />
        <div>
          <div className="text-[15px] font-semibold leading-5 tracking-[-0.02em] text-ink">
            UrbanFlow
          </div>
          <div className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted">
            Mumbai intelligence
          </div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Primary">
        {navigation.map((group) => (
          <div key={group.label} className="mb-3.5">
            <p className="mb-1 px-2 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[#98A2B3]">
              {group.label}
            </p>
            <ul className="space-y-px">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cx(
                        "flex items-center gap-2.5 rounded-md px-2 py-[6px] text-[12.5px] transition-colors",
                        isActive
                          ? "bg-accent-soft font-medium text-accent"
                          : "text-[#475467] hover:bg-canvas hover:text-ink",
                      )
                    }
                  >
                    <item.icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.8} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-[#475467]">
            <span
              className={cx(
                "h-1.5 w-1.5 rounded-full",
                meta ? (meta.dataset.demo > 0 ? "bg-[#B54708]" : "bg-[#067647]") : "bg-[#98A2B3]",
              )}
            />
            {meta ? `${meta.dataset.total.toLocaleString("en-IN")} records` : "API unavailable"}
          </span>
          <Link
            to="/data-sources"
            onClick={onNavigate}
            className="text-[10.5px] font-medium text-accent hover:text-accent-dark"
          >
            Pipeline →
          </Link>
        </div>
        <p className="mt-1 text-[9.5px] leading-4 text-[#98A2B3]">
          {meta
            ? `${meta.dataset.live.toLocaleString("en-IN")} live · ${meta.dataset.demo.toLocaleString(
                "en-IN",
              )} demo · updated ${relativeTime(meta.dataset.last_updated)}`
            : "Connecting to the UrbanFlow API…"}
        </p>
        <p className="mt-0.5 text-[9.5px] leading-4 text-[#B0B7C3]">
          Academic data engineering project · Mumbai
        </p>
      </div>
    </div>
  );
}

export function Layout() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    api
      .getMeta()
      .then((data) => {
        if (active) setMeta(data);
      })
      .catch(() => {
        if (active) setMeta(null);
      });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const pageTitle = PAGE_TITLES[location.pathname] ?? "Page not found";

  useEffect(() => {
    document.title = `${pageTitle} · UrbanFlow`;
  }, [pageTitle]);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[1100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-[13px] focus:text-ink focus:shadow-panel"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] border-r border-line bg-white lg:block">
        <SidebarContent meta={meta} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/30 animate-fade-in"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[272px] border-r border-line bg-white shadow-panel animate-fade-in">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded p-1.5 text-muted hover:bg-canvas"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent meta={meta} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-[236px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-[12px] sm:flex">
              <span className="text-muted">Mumbai</span>
              <span className="text-[#D0D5DD]">/</span>
              <span className="font-medium text-ink">{pageTitle}</span>
            </div>
            <div className="text-[13px] font-semibold text-ink sm:hidden">UrbanFlow</div>
          </div>
          <div className="flex items-center gap-3">
            {meta?.dataset.demo_mode ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-[#D1E0FF] bg-[#F5F8FF] px-2.5 py-1 text-[10.5px] font-medium text-[#175CD3] sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Demo data included
              </span>
            ) : meta ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-[#ABEFC6] bg-[#ECFDF3] px-2.5 py-1 text-[10.5px] font-medium text-[#067647] sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#067647]" />
                Live dataset
              </span>
            ) : null}
            <span className="hidden text-[11.5px] text-muted md:block">
              {meta?.dataset.last_updated
                ? `Incident data updated ${relativeTime(meta.dataset.last_updated)}`
                : "Awaiting data"}
            </span>
          </div>
        </header>

        <main id="main-content" className="flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-4 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>
              UrbanFlow · Smart traffic &amp; road disruption intelligence ·{" "}
              <span className="text-[#98A2B3]">Academic demonstration</span>
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink"
              >
                © OpenStreetMap contributors
              </a>
              <span className="text-[#D0D5DD]">·</span>
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink"
              >
                Weather by Open-Meteo
              </a>
              <span className="text-[#D0D5DD]">·</span>
              <Link to="/about" className="hover:text-ink">
                Methodology
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
