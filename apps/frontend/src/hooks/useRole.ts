import { useAuthStore } from '../stores/authStore';

export function useRole() {
  const user       = useAuthStore((s) => s.user);
  const viewAsRole = useAuthStore((s) => s.viewAsRole);

  const realRole = user?.role?.name ?? '';
  // Admin can preview any role; all others always use their real role
  const role = (realRole === 'admin' && viewAsRole) ? viewAsRole : realRole;

  return {
    role,
    realRole,
    isPreviewingRole: realRole === 'admin' && !!viewAsRole,
    // Niveles acumulativos
    isAdmin:        role === 'admin',
    isSupervisor:   ['admin', 'supervisor'].includes(role),
    isOperator:     ['admin', 'supervisor', 'operator'].includes(role),
    isAuxiliar:     role === 'auxiliar',
    isFinanciero:   role === 'financiero',
    // Capacidades específicas
    canCreateExpense:    ['admin', 'supervisor', 'operator'].includes(role),
    canCreateProject:    ['admin', 'supervisor'].includes(role),
    canCreatePayroll:    ['admin', 'supervisor', 'operator', 'auxiliar'].includes(role),
    canApprovePayroll:   ['admin', 'supervisor'].includes(role),
    canCreateQuotation:  ['admin', 'supervisor', 'operator'].includes(role),
    canManageOrders:     ['admin', 'supervisor'].includes(role),
    canProcessPayments:  ['admin', 'supervisor', 'auxiliar'].includes(role),
    canViewReports:      ['admin', 'supervisor', 'financiero'].includes(role),
    canViewFinancials:   ['admin', 'supervisor', 'financiero'].includes(role),
    canManageUsers:      role === 'admin',
    canViewPayrolls:     ['admin', 'supervisor', 'operator', 'auxiliar'].includes(role),
    canViewProjects:     ['admin', 'supervisor', 'operator', 'financiero'].includes(role),
    canViewExpenses:     ['admin', 'supervisor', 'operator', 'financiero'].includes(role),
    canViewQuotations:   ['admin', 'supervisor', 'operator', 'financiero'].includes(role),
  };
}
