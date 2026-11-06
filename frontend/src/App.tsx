import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { usePageViews } from "./lib/analytics";
import AboutPage from "./pages/AboutPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DataSourcesPage from "./pages/DataSourcesPage";
import DisruptionsPage from "./pages/DisruptionsPage";
import MapPage from "./pages/MapPage";
import NotFoundPage from "./pages/NotFoundPage";
import OverviewPage from "./pages/OverviewPage";
import PlatformAnalyticsPage from "./pages/PlatformAnalyticsPage";
import RouteCheckerPage from "./pages/RouteCheckerPage";

function PageViewTracker() {
  usePageViews();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <PageViewTracker />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/disruptions" element={<DisruptionsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/platform-analytics" element={<PlatformAnalyticsPage />} />
          <Route path="/route-check" element={<RouteCheckerPage />} />
          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
