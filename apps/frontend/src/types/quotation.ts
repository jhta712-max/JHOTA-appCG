// ── Enums ─────────────────────────────────────────────────────

export type QuotationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ADVANCE_PAID'
  | 'IN_PROGRESS'
  | 'PARTIAL_INVOICED'
  | 'INVOICED'
  | 'PAID'
  | 'CANCELLED';

export type QuotationLinkType =
  | 'ADVANCE'
  | 'PARTIAL_INVOICE'
  | 'FINAL_INVOICE'
  | 'COMPLEMENTARY';

export type QuotationCurrency = 'DOP' | 'USD' | 'EUR';

export type PaymentMethodQ = 'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER';

// ── Labels ────────────────────────────────────────────────────

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  PENDING:          'Pendiente',
  APPROVED:         'Aprobada',
  ADVANCE_PAID:     'Anticipo pagado',
  IN_PROGRESS:      'En proceso',
  PARTIAL_INVOICED: 'Parcialmente facturada',
  INVOICED:         'Facturada',
  PAID:             'Pagada',
  CANCELLED:        'Cancelada',
};

export const QUOTATION_STATUS_COLORS: Record<QuotationStatus, string> = {
  PENDING:          'bg-gray-100 text-gray-700',
  APPROVED:         'bg-blue-100 text-blue-700',
  ADVANCE_PAID:     'bg-amber-100 text-amber-700',
  IN_PROGRESS:      'bg-indigo-100 text-indigo-700',
  PARTIAL_INVOICED: 'bg-orange-100 text-orange-700',
  INVOICED:         'bg-purple-100 text-purple-700',
  PAID:             'bg-green-100 text-green-700',
  CANCELLED:        'bg-red-100 text-red-700',
};

export const QUOTATION_LINK_LABELS: Record<QuotationLinkType, string> = {
  ADVANCE:          'Anticipo',
  PARTIAL_INVOICE:  'Factura parcial',
  FINAL_INVOICE:    'Factura final',
  COMPLEMENTARY:    'Complementario',
};

export const PAYMENT_METHOD_LABELS_Q: Record<PaymentMethodQ, string> = {
  CASH:     'Efectivo',
  TRANSFER: 'Transferencia',
  CARD:     'Tarjeta',
  CHECK:    'Cheque',
  OTHER:    'Otro',
};

// ── Interfaces ────────────────────────────────────────────────

export interface QuotationPayment {
  id:            string;
  quotationId:   string;
  amount:        number;
  paymentDate:   string;
  paymentMethod: PaymentMethodQ;
  description:   string;
  notes?:        string | null;
  registeredBy:  { id: string; name: string };
  expense?:      { id: string; amount: number; description: string } | null;
  createdAt:     string;
}

export interface QuotationExpenseLink {
  id:          string;
  quotationId: string;
  expenseId:   string;
  linkType:    QuotationLinkType;
  notes?:      string | null;
  linkedBy:    { id: string; name: string };
  expense:     {
    id:          string;
    amount:      number;
    description: string;
    expenseDate: string;
    paymentMethod: string;
  };
  createdAt:   string;
}

export interface QuotationAttachment {
  id:           string;
  quotationId:  string;
  fileName:     string;
  fileSize:     number;
  mimeType:     string;
  isPrimary:    boolean;
  uploadedBy:   { id: string; name: string };
  createdAt:    string;
}

export interface Quotation {
  id:              string;
  projectId:       string;
  categoryId?:     number | null;
  supplierName:    string;
  supplierRnc?:    string | null;
  quotationNumber?: string | null;
  quotationDate:   string;
  validUntil?:     string | null;
  currency:        QuotationCurrency;
  subtotal:        number;
  itbisAmount:     number;
  total:           number;
  description:     string;
  paymentTerms?:   string | null;
  advancePct?:     number | null;
  deliveryDays?:   number | null;
  observations?:   string | null;
  notes?:          string | null;
  status:          QuotationStatus;
  project:         { id: string; code: string; name: string };
  category?:       { id: number; name: string; icon?: string } | null;
  createdBy:       { id: string; name: string };
  payments?:       QuotationPayment[];
  expenseLinks?:   QuotationExpenseLink[];
  attachments?:    QuotationAttachment[];
  _count?:         { payments: number; expenseLinks: number; attachments: number };
  createdAt:       string;
  updatedAt:       string;
}

export interface QuotationSummary {
  quotationId:    string;
  total:          number;
  totalPaid:      number;
  totalLinked:    number;
  pendingBalance: number;
  advanceAmount:  number;
  paymentsCount:  number;
  linksCount:     number;
  paidPct:        number;
}
