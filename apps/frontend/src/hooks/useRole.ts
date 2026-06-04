import { useAuthStore } from '../stores/authStore';

export function useRole() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role?.name ?? '';

  return {
    role,
    // Niveles acumulativos
    isAdmin:        role === 'admin',
    isSupervisor:   ['admin', 'supervisor'].includes(role),
    isOperator:     ['admin', 'supervisor', 'operator'].includes(role),
    isAuxiliar:     role === 'auxiliar',
    isFinanciero:   role === 'financiero',
    // Capacidades específicas
    canCreateExpense:    ['admin', 'supervisor', 'operator'].includes(role),
    canCreateProject:    ['admin', 'supervisor'].includes(role),
    canCreatePayroll:    ['admin', 'supervisor', 'operator'].includes(role),
    canApprovePayroll:   ['admin', 'supervisor'].includes(role),
    canCreateQuotation:  ['admin', 'supervisor', 'operator'].includes(role),
    canManageOrders:     ['admin', 'supervisor'].includes(role),
    canProcessPayments:  ['admin', 'supervisor', 'auxiliar'].includes(role),
    canViewReports:      ['admin', 'supervisor', 'financiero'].includes(role),
    canViewFinancials:   ['admin', 'supervisor', 'financiero'].includes(role),
    canManageUsers:      role === 'admin',
    canViewPayrolls:     ['admin', 'supervisor', 'operator'].includes(role),
    canViewProjects:     ['admin', 'supervisor', 'operator', 'financiero'].includes(role),
    canViewExpenses:     ['admin', 'supervisor', 'operator', 'financiero'].includes(role),
    canViewQuotations:   ['admin', 'supervisor', 'operator', 'financiero'].includes(role),
  };
}
