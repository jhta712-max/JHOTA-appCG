import React, { useEffect, useState, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

import { useAuthStore } from './stores/authStore';
import { authApi }       from './api/index';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout             from './components/layout/Layout';
// Login se carga eager: es la primera pantalla de cada sesión
import LoginPage          from './pages/auth/LoginPage';

// Resto de páginas: lazy loading por ruta (code splitting).
// Dashboard incluido — arrastra recharts (~400 kB) que no debe ir en el bundle inicial.
const DashboardPage        = lazy(() => import('./pages/dashboard/DashboardPage'));
const ProjectsPage         = lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectDetailPage    = lazy(() => import('./pages/projects/ProjectDetailPage'));
const ProjectFormPage      = lazy(() => import('./pages/projects/ProjectFormPage'));
const ProjectFinancialPage = lazy(() => import('./pages/projects/ProjectFinancialPage'));
const ExpensesPage         = lazy(() => import('./pages/expenses/ExpensesPage'));
const NewExpensePage       = lazy(() => import('./pages/expenses/NewExpensePage'));
const ExpenseDetailPage    = lazy(() => import('./pages/expenses/ExpenseDetailPage'));
const EditExpensePage      = lazy(() => import('./pages/expenses/EditExpensePage'));
const UsersPage            = lazy(() => import('./pages/users/UsersPage'));
const CategoriesPage       = lazy(() => import('./pages/categories/CategoriesPage'));
const ReportsPage          = lazy(() => import('./pages/reports/ReportsPage'));
const ExportPage           = lazy(() => import('./pages/reports/ExportPage'));
const AcceptInvitePage     = lazy(() => import('./pages/invitations/AcceptInvitePage'));
const SetupPage            = lazy(() => import('./pages/auth/SetupPage'));
const ForgotPasswordPage   = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage    = lazy(() => import('./pages/auth/ResetPasswordPage'));
const PayrollsPage         = lazy(() => import('./pages/payroll/PayrollsPage'));
const PayrollDetailPage    = lazy(() => import('./pages/payroll/PayrollDetailPage'));
const PayrollFormPage      = lazy(() => import('./pages/payroll/PayrollFormPage'));
const MonitoringPage       = lazy(() => import('./pages/admin/MonitoringPage'));
const CardsPage            = lazy(() => import('./pages/admin/CardsPage'));
const PaymentOrdersPage    = lazy(() => import('./pages/payment-orders/PaymentOrdersPage'));
const PendingOrdersPage    = lazy(() => import('./pages/payment-orders/PendingOrdersPage'));
const OfficeExpensesPage   = lazy(() => import('./pages/office-expenses/OfficeExpensesPage'));
const QuotationsPage       = lazy(() => import('./pages/quotations/QuotationsPage'));
const QuotationFormPage    = lazy(() => import('./pages/quotations/QuotationFormPage'));
const QuotationDetailPage  = lazy(() => import('./pages/quotations/QuotationDetailPage'));
const ImportBatchesPage    = lazy(() => import('./pages/projects/ImportBatchesPage'));
const SuppliersPage        = lazy(() => import('./pages/suppliers/SuppliersPage'));
const SupplierDetailPage   = lazy(() => import('./pages/suppliers/SupplierDetailPage'));
const NotificationContactsPage = lazy(() => import('./pages/admin/NotificationContactsPage'));
const ContratosAjustadosPage   = lazy(() => import('./pages/contratos-ajustados/ContratosAjustadosPage'));
const AdminPayrollsPage        = lazy(() => import('./pages/admin-payroll/AdminPayrollsPage'));
const AdminPayrollFormPage     = lazy(() => import('./pages/admin-payroll/AdminPayrollFormPage'));
const AdminPayrollDetailPage   = lazy(() => import('./pages/admin-payroll/AdminPayrollDetailPage'));
const AdminEmployeesPage       = lazy(() => import('./pages/admin-payroll/AdminEmployeesPage'));
const AdminEmployeeDetailPage  = lazy(() => import('./pages/admin-payroll/AdminEmployeeDetailPage'));
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import DataDeletionPage  from './pages/DataDeletionPage';

function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] font-['Barlow_Condensed']">
        Cargando…
      </p>
    </div>
  );
}

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
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/politica-privacidad"  element={<PrivacyPolicyPage />} />
              <Route path="/eliminacion-datos"    element={<DataDeletionPage />} />
              <Route path="/login"                element={<LoginPage />} />
              <Route path="/setup"                element={<SetupPage />} />
              <Route path="/forgot-password"      element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
              <Route path="/invite/:token"        element={<AcceptInvitePage />} />

              <Route path="/" element={
                <PrivateRoute><Layout /></PrivateRoute>
              }>
                <Route index                        element={<DashboardPage />} />

                {/* Proyectos */}
                <Route path="projects"             element={<ProjectsPage />} />
                <Route path="projects/new"         element={<ProjectFormPage />} />
                <Route path="projects/import-batches"   element={<ImportBatchesPage />} />
                <Route path="projects/:id"              element={<ProjectDetailPage />} />
                <Route path="projects/:id/edit"         element={<ProjectFormPage />} />
                <Route path="projects/:id/financial"    element={<ProjectFinancialPage />} />

                {/* Gastos */}
                <Route path="expenses"             element={<ExpensesPage />} />
                <Route path="expenses/new"         element={<NewExpensePage />} />
                <Route path="expenses/:id"         element={<ExpenseDetailPage />} />
                <Route path="expenses/:id/edit"    element={<EditExpensePage />} />

                {/* Reportes y Exportación */}
                <Route path="reports"              element={<ReportsPage />} />
                <Route path="export"               element={<ExportPage />} />

                {/* Nóminas */}
                <Route path="payrolls"             element={<PayrollsPage />} />
                <Route path="payrolls/new"         element={<PayrollFormPage />} />
                <Route path="payrolls/:id"         element={<PayrollDetailPage />} />
                <Route path="payrolls/:id/edit"    element={<PayrollFormPage />} />

                {/* Cotizaciones */}
                <Route path="quotations"           element={<QuotationsPage />} />
                <Route path="quotations/new"       element={<QuotationFormPage />} />
                <Route path="quotations/:id"       element={<QuotationDetailPage />} />
                <Route path="quotations/:id/edit"  element={<QuotationFormPage />} />

                {/* Suplidores */}
                <Route path="suppliers"            element={<SuppliersPage />} />
                <Route path="suppliers/:id"        element={<SupplierDetailPage />} />

                {/* Contratos Ajustados */}
                <Route path="contratos-ajustados"  element={<ContratosAjustadosPage />} />

                {/* Nómina Administrativa */}
                <Route path="admin-payroll"                    element={<AdminPayrollsPage />} />
                <Route path="admin-payroll/new"                element={<AdminPayrollFormPage />} />
                <Route path="admin-payroll/employees"          element={<AdminEmployeesPage />} />
                <Route path="admin-payroll/employees/:id"      element={<AdminEmployeeDetailPage />} />
                <Route path="admin-payroll/:id"                element={<AdminPayrollDetailPage />} />

                {/* Administración */}
                <Route path="users"                       element={<UsersPage />} />
                <Route path="notification-contacts"        element={<NotificationContactsPage />} />
                <Route path="categories"           element={<CategoriesPage />} />
                <Route path="cards"                element={<CardsPage />} />
                <Route path="payment-orders"      element={<PaymentOrdersPage />} />
                <Route path="pending-orders"      element={<PendingOrdersPage />} />
                <Route path="office-expenses"     element={<OfficeExpensesPage />} />
                <Route path="monitoring"           element={<MonitoringPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </AuthHydrator>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
