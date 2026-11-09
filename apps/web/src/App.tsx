import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/shell";
import { ActivityRealtimeBridge } from "./lib/realtime";
import { useMe } from "./lib/query";
import LandingPage from "./pages/LandingPage";
import SignInPage from "./pages/SignInPage";
import DocsPage from "./pages/DocsPage";
import NotFoundPage from "./pages/NotFoundPage";
import OverviewPage from "./pages/OverviewPage";
import RepositoriesPage from "./pages/RepositoriesPage";
import RepositoryDetailPage from "./pages/RepositoryDetailPage";
import DocumentationPage from "./pages/DocumentationPage";
import PatchesPage from "./pages/PatchesPage";
import JobsPage from "./pages/JobsPage";
import ReviewPage from "./pages/ReviewPage";
import ActivityPage from "./pages/ActivityPage";
import ActivityDetailPage from "./pages/ActivityDetailPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const me = useMe();
  return (
    <>
      <ActivityRealtimeBridge readKey={me.data?.realtimeKey ?? null} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<OverviewPage />} />
          <Route path="/dashboard/repositories" element={<RepositoriesPage />} />
          <Route path="/dashboard/repositories/:id" element={<RepositoryDetailPage />} />
          <Route path="/dashboard/docs" element={<DocumentationPage />} />
          <Route path="/dashboard/patches" element={<PatchesPage />} />
          <Route path="/dashboard/jobs" element={<JobsPage />} />
          <Route path="/dashboard/reviews/:runId" element={<ReviewPage />} />
          <Route path="/dashboard/activity" element={<ActivityPage />} />
          <Route path="/dashboard/activity/:logId" element={<ActivityDetailPage />} />
          <Route path="/dashboard/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
