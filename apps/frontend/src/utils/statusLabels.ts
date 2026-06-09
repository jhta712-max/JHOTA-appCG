// ── Nóminas ───────────────────────────────────────────────────
export const PAYROLL_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
};
export const PAYROLL_STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-yellow-100 text-yellow-800 border-yellow-300',
  APPROVED: 'bg-blue-100 text-blue-800 border-blue-300',
  PAID:     'bg-green-100 text-green-800 border-green-300',
  VOIDED:   'bg-red-100 text-red-800 border-red-300',
};

// ── Nóminas (Listado) ──────────────────────────────────────────
export const PAYROLL_LIST_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
};
export const PAYROLL_LIST_STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PAID:     'bg-green-100 text-green-700',
  VOIDED:   'bg-red-100 text-red-700',
};

// ── Órdenes de pago ───────────────────────────────────────────
export const PAYMENT_ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', PAID: 'Pagada', VOIDED: 'Anulada',
};
export const PAYMENT_ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID:    'bg-green-100 text-green-700',
  VOIDED:  'bg-gray-100 text-gray-500',
};
