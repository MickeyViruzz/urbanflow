import { ArrowRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Card, PageHeader, SectionTitle } from "../components/ui";

function ArchitectureNode({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex-1 rounded-md border border-line bg-[#FAFBFC] px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-accent">{step}</p>
      <p className="mt-1 text-[11.5px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-muted">{description}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden shrink-0 items-center px-1 lg:flex" aria-hidden="true">
      <ArrowRight className="h-3.5 w-3.5 text-[#98A2B3]" />
    </div>
  );
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-[11.5px] leading-5 text-[#475467]">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#98A2B3]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Project"
        title="About UrbanFlow"
        description="A data engineering honours project that collects, processes and presents Mumbai road disruption intelligence from public data sources."
      />

      <Card className="px-5 py-4">
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-accent">
              Problem statement
            </p>
            <p className="mt-2 text-[13px] leading-6 text-[#344054]">
              Road disruptions in Mumbai are reported across scattered public notices, mapping
              data and weather feeds. Commuters and civic teams have no single, traceable view of
              what has been reported, where it applies or how reliable the source is. Information
              is fragmented, inconsistently formatted and rarely linked back to its origin.
            </p>
            <p className="mt-2 text-[13px] leading-6 text-[#344054]">
              UrbanFlow demonstrates an end-to-end data pipeline that acquires public records,
              normalises and classifies their text, removes duplicates, stores them with source
              attribution, and exposes the result through a transparent analytical interface.
            </p>
          </div>
          <div className="rounded-md border border-line bg-[#FAFBFC] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
              What this system does not claim
            </p>
            <p className="mt-2 text-[11.5px] leading-5 text-[#475467]">
              UrbanFlow is not an official traffic control system. It does not receive live traffic
              speeds, guarantee the fastest route, or confirm that an unrecorded road is clear.
              Every result is limited to records the pipeline has actually collected and stored.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge className="border-[#B2DDFF] bg-[#EFF8FF] text-[#175CD3]">Descriptive analytics</Badge>
              <Badge className="border-line bg-white text-[#475467]">Source-attributed</Badge>
              <Badge className="border-line bg-white text-[#475467]">Mumbai coverage</Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionTitle
            title="Project objectives"
            description="What the implementation is designed to demonstrate"
          />
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            {[
              ["Acquire", "Collect permitted public traffic, construction and weather data."],
              ["Process", "Normalise dates, clean text, extract locations, classify and deduplicate."],
              ["Store", "Model records in PostgreSQL with sources, constraints and collection logs."],
              ["Explain", "Present provenance, processing quality and uncertainty in the interface."],
              ["Analyse", "Derive descriptive trends and first-party usage analytics from stored data."],
              ["Apply", "Provide a corridor-based route disruption check with routing-engine context."],
            ].map(([title, description], index) => (
              <div key={title} className="rounded-md border border-line px-3 py-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-accent">
                  0{index + 1} · {title}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#475467]">{description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <SectionTitle
            title="Data acquisition"
            description="Public sources, access method and current status"
          />
          <div className="divide-y divide-line border-t border-line">
            {[
              {
                name: "Open-Meteo",
                method: "REST API",
                detail: "Daily Mumbai weather observations and forecast. No API key.",
                status: "Working",
                live: true,
              },
              {
                name: "OpenStreetMap / Overpass",
                method: "REST API",
                detail:
                  "Road segments tagged as construction within the Mumbai coverage box. OSM does not confirm operational status, so these records are marked unknown.",
                status: "Working",
                live: true,
              },
              {
                name: "Mumbai Traffic Police notices",
                method: "BeautifulSoup scraper",
                detail:
                  "robots.txt checked before fetching. Inaccessible from this environment; failures are logged, not replaced with invented data. Notices are stored with an unknown status unless structured validity dates are available.",
                status: "Intermittent",
                live: false,
              },
              {
                name: "UrbanFlow demonstration dataset",
                method: "Deterministic sample",
                detail: "Synthetic records used for academic evaluation and always labelled demo.",
                status: "Sample",
                live: false,
              },
            ].map((source) => (
              <div key={source.name} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11.5px] font-medium text-ink">{source.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted">{source.method}</p>
                  </div>
                  <Badge
                    className={
                      source.live
                        ? "border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]"
                        : source.status === "Intermittent"
                          ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
                          : "border-line bg-[#F9FAFB] text-[#475467]"
                    }
                  >
                    {source.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[10.5px] leading-4 text-muted">{source.detail}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <p className="text-[10px] leading-4 text-muted">
              No restricted site is bypassed. If a source cannot be collected, its failure is
              visible in the pipeline log and the application states the limitation.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle
          title="System architecture"
          description="Local-first stack designed to run without distributed infrastructure"
        />
        <div className="flex flex-col gap-2 px-4 pb-4 lg:flex-row lg:items-stretch">
          <ArchitectureNode
            step="01 · Sources"
            title="Public data"
            description="Open-Meteo, OpenStreetMap Overpass, traffic-police notices, labelled sample data."
          />
          <Arrow />
          <ArchitectureNode
            step="02 · Extract"
            title="Python collectors"
            description="Requests, BeautifulSoup, pandas. Source-specific parsers and graceful failure."
          />
          <Arrow />
          <ArchitectureNode
            step="03 · Transform"
            title="ETL + NLP"
            description="Clean, parse, classify (TF-IDF/SVM), extract locations, summarise, validate, deduplicate."
          />
          <Arrow />
          <ArchitectureNode
            step="04 · Store"
            title="PostgreSQL"
            description="Incidents, weather, sources, run logs and first-party analytics events."
          />
          <Arrow />
          <ArchitectureNode
            step="05 · Serve"
            title="FastAPI + React"
            description="Typed REST endpoints queried by a React, Tailwind, Recharts and Leaflet interface."
          />
        </div>
        <div className="border-t border-line px-4 py-3">
          <div className="flex flex-col gap-2 text-[10.5px] leading-5 text-muted lg:flex-row lg:items-center lg:justify-between">
            <p>
              <span className="font-medium text-[#344054]">Data flow:</span> fetch → normalise →
              clean text → classify + extract location → validate → fingerprint/deduplicate → load →
              aggregate on query → visualise.
            </p>
            <p className="shrink-0">
              External routing: Nominatim geocoding and OSRM route geometry
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionTitle
            title="Text analytics & classification"
            description="Transparent, reproducible and explainable during evaluation"
          />
          <div className="px-4 pb-4">
            <BulletList
              items={[
                "HTML stripping, whitespace normalisation, NLTK tokenisation and English stopword removal.",
                "TF-IDF (unigrams + bigrams) with a linear SVM trained on a compact, in-repository labelled notice corpus.",
                "Deterministic keyword rules act as a guardrail for unambiguous notices and as a fallback if the model is unavailable.",
                "Location extraction matches notice text against a curated Mumbai gazetteer; no generative model invents a location.",
                "Extractive summarisation scores sentences by content-word frequency for a short, deterministic summary.",
                "Categories: Accident, Road Closure, Construction, Traffic Diversion, Public Event, Parking Restriction and Other.",
              ]}
            />
            <p className="mt-3 text-[10.5px] leading-4 text-muted">
              Classification is an aid, not a legal determination. Ambiguous notices can be
              misclassified; the category and method are stored with the processed record so the
              result can be inspected.
            </p>
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <SectionTitle
            title="Technology stack"
            description="Stable, local dependencies suitable for a student team"
          />
          <div className="space-y-2.5 px-4 pb-4">
            {[
              ["Frontend", "React 18, TypeScript, Tailwind CSS, Recharts, Leaflet / React-Leaflet"],
              ["Backend", "Python 3.12, FastAPI, SQLAlchemy 2, Pydantic"],
              ["Data engineering", "Pandas, Requests, BeautifulSoup4, scikit-learn, NLTK"],
              ["Database", "PostgreSQL 16 with constraints and indexes"],
              ["External services", "Open-Meteo API, OpenStreetMap Overpass, Nominatim, OSRM"],
              ["Quality", "Pytest for ETL and API logic, TypeScript type checking, Vite production build"],
            ].map(([group, detail]) => (
              <div key={group} className="border-b border-line pb-2 last:border-0 last:pb-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {group}
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-[#344054]">{detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle
            title="Demonstration data"
            description="Sample records are deliberately separated from live collection"
          />
          <div className="px-4 pb-4">
            <BulletList
              items={[
                "The deterministic sample dataset is generated in-repository with a fixed seed and documented schema.",
                "Every sample incident stores origin = demo and points to the UrbanFlow Demonstration Dataset source.",
                "Demo records are labelled in tables, map records, charts, the dashboard banner and the detail panel.",
                "Demo and live data can be filtered separately throughout the interface.",
                "Synthetic weather is used only if no live Open-Meteo data is available.",
                "The dataset exists to make evaluation possible without internet access; it is never described as live.",
              ]}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="Limitations"
            description="Known constraints stated explicitly rather than hidden"
          />
          <div className="px-4 pb-4">
            <BulletList
              items={[
                "No live traffic-speed provider is integrated. OSRM durations are free-flow network estimates.",
                "Official Mumbai Traffic Police notices may be unavailable to automated collection; this is logged per run.",
                "Incident locations are often locality centroids; OpenStreetMap roadworks use the road-segment centre. Corridor matching uses ±350 m and can miss or over-include records.",
                "OpenStreetMap construction tags describe mapped infrastructure, not a confirmed active closure or start/end date. Those records are shown with an unknown status; route checks only consider OSM records edited within the last 12 months.",
                "Weather correlation is descriptive; a small or incomplete sample limits interpretation.",
                "The admin token protects the refresh endpoint but is not a full authentication or authorisation system.",
                "Site analytics are first-party and only cover usage of this application, not external audiences.",
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <SectionTitle title="Future scope" description="Realistic next steps for the project" />
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            {[
              ["Official data partnerships", "Formal access to municipal advisory feeds or IMD alerts with documented terms."],
              ["Scheduled collection", "Cron or a lightweight scheduler with alerting on failed runs and source drift."],
              ["Road-network matching", "PostGIS and a road graph to snap incidents to route segments instead of straight-line corridors."],
              ["Verification workflow", "Human review states for collected notices and confidence-aware public display."],
              ["Richer analytics", "Weekly seasonality, hotspot detection and source-quality reporting once enough data exists."],
              ["User features", "Saved routes and opt-in disruption notifications with privacy-preserving design."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-md border border-line px-3 py-2.5">
                <p className="text-[11px] font-medium text-ink">{title}</p>
                <p className="mt-1 text-[10.5px] leading-4 text-muted">{description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <SectionTitle
            title="Data ethics & attribution"
            description="Public data handled transparently"
          />
          <div className="px-4 pb-4">
            <p className="text-[11.5px] leading-5 text-[#475467]">
              The pipeline respects robots.txt, applies request timeouts, avoids aggressive polling
              and does not bypass access controls. First-party analytics record page, search and
              feature events only; no IP address, user agent, cookie or account identifier is
              stored.
            </p>
            <div className="mt-3 space-y-1.5 text-[10.5px]">
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-medium text-accent hover:text-accent-dark"
              >
                © OpenStreetMap contributors (ODbL) <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-medium text-accent hover:text-accent-dark"
              >
                Weather data by Open-Meteo (CC BY 4.0) <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href="https://project-osrm.org/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-medium text-accent hover:text-accent-dark"
              >
                Routing by OSRM <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href="https://nominatim.openstreetmap.org/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-medium text-accent hover:text-accent-dark"
              >
                Geocoding by Nominatim <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </Card>
      </div>

      <p className="mt-5 text-center text-[10.5px] text-muted">
        UrbanFlow · Data Engineering Honours project · Records are presented for analysis and never
        substitute for official traffic instructions.
      </p>
    </>
  );
}
