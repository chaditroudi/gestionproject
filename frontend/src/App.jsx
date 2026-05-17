import { Navigate, Route, Routes } from "react-router-dom";
import AccessDenied from "./components/AccessDenied";
import { useAuth } from "./state/AuthContext";
import { getDefaultRouteForRole, hasPermission } from "./constants/permissions";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import TasksPage from "./pages/TasksPage";
import TeamsPage from "./pages/TeamsPage";
import UsersPage from "./pages/UsersPage";

function ProtectedApp() {
  const { user } = useAuth();
  const defaultRoute = getDefaultRouteForRole(user?.role);

  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            hasPermission(user?.role, "view_dashboard") ? (
              <DashboardPage />
            ) : (
              <AccessDenied />
            )
          }
        />
        <Route
          path="/teams"
          element={
            hasPermission(user?.role, "view_teams") ? <TeamsPage /> : <Navigate to={defaultRoute} replace />
          }
        />
        <Route
          path="/tasks"
          element={
            hasPermission(user?.role, "view_tasks") ? <TasksPage /> : <Navigate to={defaultRoute} replace />
          }
        />
        <Route
          path="/users"
          element={
            hasPermission(user?.role, "view_users") ? <UsersPage /> : <Navigate to={defaultRoute} replace />
          }
        />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const { token } = useAuth();

  return token ? <ProtectedApp /> : <LoginPage />;
}
