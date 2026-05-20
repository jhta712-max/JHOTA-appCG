import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

import { useAuthStore } from './stores/authStore';
import { authApi }       from './api/index';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout             from './components/layout/Layout';
import LoginPage          from './pages/auth/LoginPage';
import DashboardPage      from './pages/dashboard/DashboardPage';
import ProjectsPage       from './pages/projects/ProjectsPage';
import ProjectDetailPage  from './pages/projects/ProjectDetailPage';
import ProjectFormPage     from './pages/projects/ProjectFormPage';
import ProjectFinancialPage from './pages/projects/ProjectFinancialPage';
import ExpensesPage       from './pages/expenses/ExpensesPage';
import NewExpensePage     from './pages/expenses/NewExpensePage';
import ExpenseDetailPage  from './pages/expenses/ExpenseDetailPage';
import EditExpensePage    from './pages/expenses/EditExpensePage';
import UsersPage          from './pages/users/UsersPage';
import CategoriesPage     from './pages/categories/CategoriesPage';
import ReportsPage        from './pages/reports/ReportsPage';
import ExportPage         from './pages/reports/ExportPage';
import AcceptInvitePage  from './pages/invitations/AcceptInvitePage';
import SetupPage         from './pages/auth/SetupPage';
import PayrollsPage      from './pages/payroll/PayrollsPage';
import PayrollDetailPage from './pages/payroll/PayrollDetailPage';
import PayrollFormPage   from './pages/payroll/PayrollFormPage';
import MonitoringPage    from './pages/admin/MonitoringPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/** Verifica el token al arrancar la app — limpia el estado si expiró */
function AuthHydrator({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const { isAuthenticated, clearAuth } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      setReady(true);
      return;
    }
    authApi.me()
      .then(() => setReady(true))
      .catch(() => {
        clearAuth();
        setReady(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;
  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthHydrator>
            <Routes>
              <Route path="/login"          element={<LoginPage />} />
              <Route path="/setup"          element={<SetupPage />} />
              <Route path="/invite/:token"  element={<AcceptInvitePage />} />

              <Route path="/" element={
                <PrivateRoute><Layout /></PrivateRoute>
              }>
                <Route index                        element={<DashboardPage />} />

                {/* Proyectos */}
                <Route path="projects"             element={<ProjectsPage />} />
                <Route path="projects/new"         element={<ProjectFormPage />} />
                <Route path="projects/:id"              element={<ProjectDetailPage />} />
                <Route path="projects/:id/edit"         element={<ProjectFormPage />} />
                <Route path="projects/:id/financial"    element={<ProjectFinancialPage />} />

                {/* Gastos */}
                <Route path="expenses"             element={<ExpensesPage />} />
                <Route path="expenses/new"         element={<NewExpensePage />} />
                <Route path="expenses/:id"         element={<ExpenseDetailPage />} />
                <Route path="expenses/:id/edit"    element={<EditExpensePage />} />

                {/* Reportes y Exportación */}
                