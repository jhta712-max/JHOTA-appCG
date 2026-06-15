import api from './client';
import type { Project, Expense, Category, ProjectSummary, PaginatedResponse, User, Addendum, Cubicacion, Anticipo, FinancialAnalysis, Assignment, ProjectItem } from '../types';

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login:  (data: { email: string; password: string }) => api.post('/auth/login', data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me:     () => api.get<{ success: boolean; data: User }>('/auth/me'),
};

// ── Proyectos ─────────────────────────────────────────────────
export const projectsApi = {
  list:    (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Project>>('/projects', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: Project }>(`/projects/${id}`),
  summary: (id: string) =>
    api.get<{ success: boolean; data: ProjectSummary }>(`/projects/${id}/summary`),
  create:  (data: unknown) =>
    api.post<{ success: boolean; data: Project }>('/projects', data),
  update:  (id: string, data: unknown) =>
    api.put<{ success: boolean; data: Project }>(`/projects/${id}`, data),
  // Adendas
  getAddendums:    (projectId: string) =>
    api.get<{ success: boolean; data: Addendum[] }>(`/projects/${projectId}/addendums`),
  createAddendum:  (projectId: string, data: unknown) =>
    api.post<{ success: boolean; data: Addendum }>(`/projects/${projectId}/addendums`, data),
  updateAddendum:  (projectId: string, addendumId: string, data: unknown) =>
    api.put<{ success: boolean; data: Addendum }>(`/projects/${projectId}/addendums/${addendumId}`, data),
  deleteAddendum:  (projectId: string, addendumId: string) =>
    api.delete(`/projects/${projectId}/addendums/${addendumId}`),
  // Cubicaciones y análisis financiero
  getFinancial:       (projectId: string) =>
    api.get<{ success: boolean; data: FinancialAnalysis }>(`/projects/${projectId}/financial`),
  getCubicaciones:    (projectId: string) =>
    api.get<{ success: boolean; data: Cubicacion[] }>(`/projects/${projectId}/cubicaciones`),
  createCubicacion:   (projectId: string, data: unknown) =>
    api.post<{ success: boolean; data: Cubicacion }>(`/projects/${projectId}/cubicaciones`, data),
  updateCubicacion:   (projectId: string, cubicacionId: string, data: unknown) =>
    api.put<{ success: boolean; data: Cubicacion }>(`/projects/${projectId}/cubicaciones/${cubicacionId}`, data),
  deleteCubicacion:   (projectId: string, cubicacionId: string) =>
    api.delete(`/projects/${projectId}/cubicaciones/${cubicacionId}`),
  // Anticipos
  getAnticipos:   (projectId: string) =>
    api.get<{ success: boolean; data: Anticipo[] }>(`/projects/${projectId}/anticipos`),
  createAnticipo: (projectId: string, data: unknown) =>
    api.post<{ success: boolean; data: Anticipo }>(`/projects/${projectId}/anticipos`, data),
  updateAnticipo: (projectId: string, anticipoId: string, data: unknown) =>
    api.patch<{ success: boolean; data: Anticipo }>(`/projects/${projectId}/anticipos/${anticipoId}`, data),
  deleteAnticipo: (projectId: string, anticipoId: string) =>
    api.delete(`/projects/${projectId}/anticipos/${anticipoId}`),
  // Asignaciones de operadores
  getAssignments:  (projectId: string) =>
    api.get<{ success: boolean; data: Assignment[] }>(`/projects/${projectId}/assignments`),
  assignUser:      (projectId: string, userId: string) =>
    api.post<{ success: boolean; data: Assignment }>(`/projects/${projectId}/assignments`, { userId }),
  unassignUser:    (projectId: string, userId: string) =>
    api.delete(`/projects/${projectId}/assignments/${userId}`),
  aiSummary:       (projectId: string) =>
    api.post<{ success: boolean; data: { summary: string; generatedAt: string } }>(`/projects/${projectId}/ai-summary`),
  // Items de proyecto (partidas/lotes)
  getItems:    (projectId: string) =>
    api.get<{ success: boolean; data: ProjectItem[] }>(`/projects/${projectId}/items`),
  createItem:  (projectId: string, data: { name: string }) =>
    api.post<{ success: boolean; data: ProjectItem }>(`/projects/${projectId}/items`, data),
  updateItem:  (projectId: string, itemId: string, data: { name?: string; active?: boolean }) =>
    api.patch<{ success: boolean; data: ProjectItem }>(`/projects/${projectId}/items/${itemId}`, data),
  getBatchItems: (projectId: string) =>
    api.get<{ success: boolean; data: any[] }>(`/projects/${projectId}/batch-items`),
};

// ── Gastos ────────────────────────────────────────────────────
export const expensesApi = {
  list:    (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Expense>>('/expenses', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: Expense }>(`/expenses/${id}`),
  create:  (data: unknown) =>
    api.post<{ success: boolean; data: Expense }>('/expenses', data),
  update:  (id: string, data: unknown) =>
    api.put<{ success: boolean; data: Expense }>(`/expenses/${id}`, data),
  void:    (id: string, reason: string) =>
    api.post(`/expenses/${id}/void`, { reason }),
  hardDelete: (id: string) =>
    api.delete(`/expenses/${id}`),
  getStats: () =>
    api.get<{ success: boolean; data: { byMonth: { month: string; total: number; count: number }[]; byCategory: { name: string; total: number; count: number; pct: number }[] } }>('/expenses/stats'),
  uploadAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/expenses/${id}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  approve: (id: string) =>
    api.post<{ success: boolean; data: Expense }>(`/expenses/${id}/approve`),
  reject:  (id: string, reason: string) =>
    api.post<{ success: boolean; data: Expense }>(`/expenses/${id}/reject`, { reason }),
  suggestCategory: (description: string) =>
    api.post<{ success: boolean; data: { categoryName: string | null; confidence: 'high' | 'medium' | 'low' } }>('/expenses/suggest-category', { description }),
};

// ── Categorías ────────────────────────────────────────────────
export const categoriesApi = {
  list:   () => api.get<{ success: boolean; data: Category[] }>('/categories'),
  create: (data: unknown) => api.post('/categories', data),
  update: (id: number, data: unknown) => api.put(`/categories/${id}`, data),
};

// ── Usuarios ──────────────────────────────────────────────────
export const usersApi = {
  list:   () => api.get<{ success: boolean; data: User[] }>('/users'),
  create: (data: unknown) => api.post('/users', data),
  update: (id: string, data: unknown) => api.put(`/users/${id}`, data),
  roles:  () => api.get('/users/roles'),
  changePassword: (data: unknown) => api.post('/users/change-password', data),
};

// ── OCR / IA ──────────────────────────────────────────────────
export interface OcrResult {
  date:              string | null;
  supplierName:      string | null;
  supplierRnc:       string | null;
  ncf:               string | null;
  amount:            number | null;
  itbisAmount:       number | null;
  paymentMethod:     string | null;
  description:       string | null;
  suggestedCategory: string | null;
  confidence:        'high' | 'medium' | 'low';
  warnings:          string[];
  fieldsDetected:    number;
}

// ── Nóminas ───────────────────────────────────────────────────
export interface PayrollLine {
  id:           string;
  payrollId:    string;
  lineNumber:   number;
  description:  string;
  quantity:     number;
  unit:         string;
  unitPrice:    number;
  subtotal:     number;
  notes:        string | null;
  supplierName: string | null;
  bankName:          string | null;
  bankAccount:       string | null;
  paymentBank:       string | null;
  paymentReference:  string | null;
  paidAt:            string | null;
  contratoAjustadoId: string | null;
  contratoAjustado?: {
    id: string;
    descripcionTrabajo: string;
    montoContratado: number;
  } | null;
  expenseId?: string | null;
  expense?: {
    id: string;
    amount: number;
    expenseDate: string;
    description: string;
    status: string;
  } | null;
  createdAt:         string;
  updatedAt:         string;
}

export interface Payroll {
  id:          string;
  projectId:   string;
  number:      number;
  periodStart: string;
  periodEnd:   string;
  type:        'LABOR' | 'SERVICE';
  status:      'DRAFT' | 'APPROVED' | 'PAID' | 'VOIDED';
  description: string;
  totalAmount: number;
  notes:       string | null;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  paidAt?:            string | null;
  paymentMethod?:     'CASH' | 'TRANSFER' | null;
  paymentBank?:       string | null;
  paymentReference?:  string | null;
  paymentDate?:       string | null;
  receiptNumber?:     string | null;
  receivedBy?:        string | null;
  voidedAt?:          string | null;
  voidReason?: string | null;
  expenseId?:  string | null;
  createdAt:   string;
  updatedAt:   string;
  project:     { id: string; code: string; name: string };
  createdBy:   { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
  voidedBy?:   { id: string; name: string } | null;
  lines?:         PayrollLine[];
  expense?:       { id: string; amount: number; expenseDate: string; description: string } | null;
  paymentOrder?:  { id: string; concept: string; amount: number; status: string; orderType: string; createdAt: string } | null;
  _count?:        { lines: number };
}

export const payrollApi = {
  list:   (params?: Record<string, unknown>) =>
    api.get<{ success: boolean; data: Payroll[]; pagination: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }>('/payrolls', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: Payroll }>(`/payrolls/${id}`),
  create:  (data: unknown) =>
    api.post<{ success: boolean; data: Payroll }>('/payrolls', data),
  update:  (id: string, data: unknown) =>
    api.put<{ success: boolean; data: Payroll }>(`/payrolls/${id}`, data),
  delete:  (id: string) =>
    api.delete(`/payrolls/${id}`),
  // Lines
  addLine:    (id: string, data: unknown) =>
    api.post<{ success: boolean; data: Payroll }>(`/payrolls/${id}/lines`, data),
  updateLine: (id: string, lineId: string, data: unknown) =>
    api.put<{ success: boolean; data: Payroll }>(`/payrolls/${id}/lines/${lineId}`, data),
  deleteLine: (id: string, lineId: string) =>
    api.delete<{ success: boolean; data: Payroll }>(`/payrolls/${id}/lines/${lineId}`),
  // Actions
  revertToDraft: (id: string) =>
    api.post<{ success: boolean; data: Payroll }>(`/payrolls/${id}/revert-to-draft`),
  revertToApproved: (id: string) =>
    api.post<{ success: boolean; data: Payroll }>(`/payrolls/${id}/revert-to-approved`),
  importFromOrders: (id: string) =>
    api.post<{ success: boolean; data: Payroll }>(`/payrolls/${id}/import-from-orders`),
  recordLinePayment: (id: string, lineId: string, data: { paymentBank?: string; paymentReference?: string; paidAt?: string }) =>
    api.patch<{ success: boolean; data: PayrollLine }>(`/payrolls/${id}/lines/${lineId}/payment`, data),
  updateLineContratoAjustado: (id: string, lineId: string, contratoAjustadoId: string | null) =>
    api.patch<{ success: boolean; data: Payroll }>(`/payrolls/${id}/lines/${lineId}/contrato-ajustado`, { contratoAjustadoId }),
  approve: (id: string) =>
    api.post<{ success: boolean; data: Payroll }>(`/payrolls/${id}/approve`),
  pay:     (id: string, data: unknown) =>
    api.post<{ success: boolean; data: Payroll }>(`/payrolls/${id}/pay`, data),
  void:    (id: string, voidReason: string) =>
    api.post<{ success: boolean; data: Payroll }>(`/payrolls/${id}/void`, { voidReason }),
  // Exports
  exportUrl:     (id: string) => `/api/v1/payrolls/${id}/export.xlsx`,
  exportDocxUrl: (id: string) => `/api/v1/payrolls/${id}/export.docx`,
};

export type OcrJobStatus = 'processing' | 'completed' | 'failed';
export interface OcrJobResponse {
  jobId: string;
  status: OcrJobStatus;
  result?: OcrResult;
  error?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface OcrSupplierMatch {
  id:         string;
  name:       string;
  rnc:        string | null;
  confidence: 'exact' | 'rnc';
}

export interface OcrNcfDuplicate {
  expenseId:   string | null;
  expenseCode: string | null;
  date:        string;
  source:      'expense' | 'fiscal_voucher';
}

export interface OcrCotizacionAlert {
  cotizacionId:   string;
  cotizacionCode: string;
  cotizacionAmt:  number;
  invoiceAmt:     number;
  diffPct:        number;
}

export interface OcrNcfInfo {
  code:            string;
  description:     string;
  isElectronic:    boolean;
  itbisDeductible: boolean;
}

export interface OcrEnrichmentResult {
  supplierMatch:   OcrSupplierMatch   | null;
  ncfDuplicate:    OcrNcfDuplicate    | null;
  ncfInfo:         OcrNcfInfo         | null;
  cotizacionAlert: OcrCotizacionAlert | null;
  warnings:        string[];
}

export const ocrApi = {
  analyze: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<{ jobId: string; status: OcrJobStatus }>(
      '/ocr/analyze',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90_000 },
    );
  },
  getJob: (jobId: string) =>
    api.get<OcrJobResponse>(`/ocr/jobs/${jobId}`),
  enrich: (payload: {
    supplierRnc?:  string | null;
    supplierName?: string | null;
    ncf?:          string | null;
    amount?:       number | null;
    itbisAmount?:  number | null;
    projectId?:    string | null;
  }) => api.post<{ success: boolean; data: OcrEnrichmentResult }>('/ocr/enrich', payload),
};

// ── Cotizaciones ──────────────────────────────────────────────
import type {
  Quotation, QuotationSummary, QuotationPayment, QuotationExpenseLink, QuotationAttachment,
} from '../types/quotation';

export const quotationsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<{ success: boolean; data: Quotation[]; pagination: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }>('/quotations', { params }),

  getById: (id: string) =>
    api.get<{ success: boolean; data: Quotation }>(`/quotations/${id}`),

  getSummary: (id: string) =>
    api.get<{ success: boolean; data: QuotationSummary }>(`/quotations/${id}/summary`),

  create: (data: unknown) =>
    api.post<{ success: boolean; data: Quotation }>('/quotations', data),

  update: (id: string, data: unknown) =>
    api.put<{ success: boolean; data: Quotation }>(`/quotations/${id}`, data),

  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch<{ success: boolean; data: Quotation }>(`/quotations/${id}/status`, data),

  remove: (id: string) =>
    api.delete(`/quotations/${id}`),

  suggest: (params: { projectId?: string; supplierName?: string; amount?: number }) =>
    api.get<{ success: boolean; data: Quotation[] }>('/quotations/suggest', { params }),

  // Pagos
  createPayment: (id: string, data: unknown) =>
    api.post<{ success: boolean; data: QuotationPayment }>(`/quotations/${id}/payments`, data),

  deletePayment: (id: string, paymentId: string) =>
    api.delete(`/quotations/${id}/payments/${paymentId}`),

  // Vínculos con gastos
  linkExpense: (id: string, data: { expenseId: string; linkType: string; notes?: string }) =>
    api.post<{ success: boolean; data: QuotationExpenseLink }>(`/quotations/${id}/links`, data),

  unlinkExpense: (id: string, linkId: string) =>
    api.delete(`/quotations/${id}/links/${linkId}`),

  // Adjuntos
  uploadAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ success: boolean; data: QuotationAttachment }>(
      `/quotations/${id}/attachments`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
  deleteAttachment: (id: string, attId: string) =>
    api.delete(`/quotations/${id}/attachments/${attId}`),

  attachmentUrl: (id: string, attId: string) =>
    `/api/v1/quotations/${id}/attachments/${attId}`,
};

// ── Tarjetas corporativas ─────────────────────────────────────
export interface CompanyCard {
  id:         number;
  holderName: string;
  lastFour:   string;
  cardType:   string;
  bank:       string;
  isActive:   boolean;
  _count?:    { expenses: number };
}

export const cardsApi = {
  list:       (onlyActive = true) =>
    api.get<{ success: boolean; data: CompanyCard[] }>('/cards', { params: { active: onlyActive } }),
  getById:    (id: number) =>
    api.get<{ success: boolean; data: CompanyCard }>(`/cards/${id}`),
  create:     (data: unknown) =>
    api.post<{ success: boolean; data: CompanyCard }>('/cards', data),
  update:     (id: number, data: unknown) =>
    api.put<{ success: boolean; data: CompanyCard }>(`/cards/${id}`, data),
  deactivate: (id: number) =>
    api.delete<{ success: boolean; data: CompanyCard }>(`/cards/${id}`),
};

// ── Monitoring ────────────────────────────────────────────────
export interface SystemLog {
  id:         string;
  level:      'error' | 'warn' | 'info';
  category:   string;
  message:    string;
  details?:   Record<string, unknown> | null;
  userId?:    string | null;
  endpoint?:  string | null;
  method?:    string | null;
  statusCode?: number | null;
  duration?:  number | null;
  ipAddress?: string | null;
  createdAt:  string;
}

export interface HealthResult {
  status:        'healthy' | 'degraded' | 'unhealthy';
  dbOk:          boolean;
  memoryUsedPct: number;
  uptimeSeconds: number;
  responseTime:  number;
  details:       Record<string, unknown>;
}

export interface MonitoringDashboard {
  health:        HealthResult;
  metrics: {
    period:        string;
    totalRequests: number;
    errorCount:    number;
    errorRate:     number;
    avgResponseMs: number;
    topEndpoints:  { endpoint: string; count: number }[];
    hourlyData:    { hour: string; requests: number; errors: number }[];
    statusCodes:   Record<string, number>;
  };
  recentLogs:    SystemLog[];
  businessStats: { payrolls: number; expenses: number; activeUsers: number };
  uptimePct:     number;
  generatedAt:   string;
}

export interface AiIssue {
  severity: 'high' | 'medium' | 'low';
  title:    string;
  detail:   string;
}

export interface AiRecommendation {
  priority: 'urgent' | 'normal' | 'optional';
  action:   string;
  reason:   string;
}

export interface AiAnalysisResult {
  status:          'healthy' | 'warning' | 'critical';
  summary:         string;
  issues:          AiIssue[];
  recommendations: AiRecommendation[];
  positives:       string[];
  analyzedAt:      string;
}

import type { PaymentOrder, BcrdRateResult } from '../types';

// ── Órdenes de Pago ───────────────────────────────────────────
export const paymentOrdersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<PaymentOrder>>('/payment-orders', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}`),
  create: (data: unknown) =>
    api.post<{ success: boolean; data: PaymentOrder }>('/payment-orders', data),
  update: (id: string, data: unknown) =>
    api.put<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}`, data),
  availablePayrolls: (projectId: string) =>
    api.get<{ success: boolean; data: any[] }>('/payment-orders/available-payrolls', { params: { projectId } }),
  availableExpenses: (projectId: string) =>
    api.get<{ success: boolean; data: any[] }>('/payment-orders/available-expenses', { params: { projectId } }),
  availableContracts: (projectId: string, supplierId: string) =>
    api.get<{ success: boolean; data: any[] }>('/payment-orders/available-contracts', { params: { projectId, supplierId } }),
  availableQuotations: (projectId: string, supplierId?: string) =>
    api.get<{ success: boolean; data: any[] }>('/payment-orders/available-quotations', { params: { projectId, ...(supplierId ? { supplierId } : {}) } }),
  linkExpense: (id: string, expenseId: string) =>
    api.post<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}/link-expense`, { expenseId }),
  unlinkExpense: (id: string) =>
    api.delete<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}/link-expense`),
  linkPayroll: (id: string, payrollId: string) =>
    api.post<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}/link-payroll`, { payrollId }),
  unlinkPayroll: (id: string) =>
    api.delete<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}/link-payroll`),
  markAsPaid: (
    id: string,
    fiscalVoucher?: { ncf: string; supplierRnc: string; supplierName: string; itbisAmount?: number } | null,
    paymentInfo?:   { paymentBank?: string; paymentReference?: string; paymentMethod?: string; exchangeRate?: number | null; exchangeRateValidated?: boolean } | null,
  ) =>
    api.post<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}/pay`, {
      fiscalVoucher: fiscalVoucher ?? null,
      paymentInfo:   paymentInfo   ?? null,
    }),
  getBcrdRate: (currency = 'USD') =>
    api.get<{ success: boolean; data: BcrdRateResult }>('/payment-orders/bcrd-rate', { params: { currency } }),
  generateExpense: (id: string) =>
    api.post<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}/generate-expense`),
  revertToPending: (id: string) =>
    api.post<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}/revert-to-pending`),
  void: (id: string) =>
    api.post<{ success: boolean; data: PaymentOrder }>(`/payment-orders/${id}/void`),
  hardDelete: (id: string) =>
    api.delete(`/payment-orders/${id}`),
  suggestConcept: (data: { orderType: string; supplierName?: string; projectCode?: string; projectName?: string; amount?: number; currency?: string }) =>
    api.post<{ success: boolean; data: { concept: string } }>('/payment-orders/suggest-concept', data),
};

// ── Gastos de Oficina ─────────────────────────────────────────
export type OfficeExpenseCategory = 'CLEANING_SUPPLIES' | 'CONSUMABLES' | 'OFFICE_SERVICES' | 'BIDDING' | 'OFFICE_ASSETS' | 'OTHER';
export type OfficeExpenseStatus   = 'ACTIVE' | 'VOIDED';

export const OFFICE_EXPENSE_CATEGORY_LABELS: Record<OfficeExpenseCategory, string> = {
  CLEANING_SUPPLIES: 'Insumos de limpieza',
  CONSUMABLES:       'Material gastable',
  OFFICE_SERVICES:   'Servicios de oficina',
  BIDDING:           'Licitacion',
  OFFICE_ASSETS:     'Activos de oficina',
  OTHER:             'Otros gastos de oficina',
};

export interface OfficeExpense {
  id:            string;
  category:      OfficeExpenseCategory;
  description:   string;
  amount:        string;
  itbisAmount:   string;
  expenseDate:   string;
  paymentMethod: string;
  companyCardId: string | null;
  supplierName:  string | null;
  hasFiscalDoc:  boolean;
  fiscalDocNum:  string | null;
  notes:         string | null;
  status:        OfficeExpenseStatus;
  createdById:   string;
  createdAt:     string;
  createdBy:     { id: string; name: string; email: string };
  companyCard:   { id: string; holderName: string; lastFour: string; bank: string } | null;
}

export interface OfficeExpenseSummary {
  currentMonth: { total: number; count: number };
  allTime:      { total: number; count: number };
  byCategory:   { category: OfficeExpenseCategory; total: number; count: number }[];
}

export const officeExpensesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<{ success: boolean; data: OfficeExpense[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/office-expenses', { params }),
  getOne: (id: string) =>
    api.get<{ success: boolean; data: OfficeExpense }>(`/office-expenses/${id}`),
  summary: () =>
    api.get<{ success: boolean; data: OfficeExpenseSummary }>('/office-expenses/summary'),
  create: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: OfficeExpense }>('/office-expenses', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<{ success: boolean; data: OfficeExpense }>(`/office-expenses/${id}`, data),
  void: (id: string) =>
    api.delete<{ success: boolean; data: OfficeExpense }>(`/office-expenses/${id}`),
};

// ── Suplidores ────────────────────────────────────────────────
import type { Supplier, SupplierHistory, SupplierBankAccount, SupplierCreditLine, SupplierCreditPayment } from '../types';

export const suppliersApi = {
  list:         (params?: { search?: string; onlyActive?: boolean }) =>
    api.get<{ success: boolean; data: Supplier[] }>('/suppliers', { params }),
  getById:      (id: string) =>
    api.get<{ success: boolean; data: Supplier }>(`/suppliers/${id}`),
  getHistory:   (id: string) =>
    api.get<{ success: boolean; data: SupplierHistory }>(`/suppliers/${id}/history`),
  create:       (data: unknown) =>
    api.post<{ success: boolean; data: Supplier }>('/suppliers', data),
  update:       (id: string, data: unknown) =>
    api.put<{ success: boolean; data: Supplier }>(`/suppliers/${id}`, data),
  toggleActive: (id: string) =>
    api.patch<{ success: boolean; data: Supplier }>(`/suppliers/${id}/toggle`),
  // Cuentas bancarias
  getBankAccounts:    (id: string) =>
    api.get<{ success: boolean; data: SupplierBankAccount[] }>(`/suppliers/${id}/bank-accounts`),
  addBankAccount:     (id: string, data: unknown) =>
    api.post<{ success: boolean; data: SupplierBankAccount }>(`/suppliers/${id}/bank-accounts`, data),
  updateBankAccount:  (id: string, accountId: string, data: unknown) =>
    api.put<{ success: boolean; data: SupplierBankAccount }>(`/suppliers/${id}/bank-accounts/${accountId}`, data),
  deleteBankAccount:  (id: string, accountId: string) =>
    api.delete(`/suppliers/${id}/bank-accounts/${accountId}`),
  setDefaultBankAccount: (id: string, accountId: string) =>
    api.patch<{ success: boolean; data: SupplierBankAccount }>(`/suppliers/${id}/bank-accounts/${accountId}/set-default`),
  validateRNC: (rnc: string) =>
    api.get<{ success: boolean; data: { found: boolean; rnc: string; name?: string; status?: string; category?: string | null; unreachable?: boolean } }>(`/suppliers/validate-rnc/${encodeURIComponent(rnc)}`),
  // Líneas de crédito
  getCreditLines: (supplierId: string) =>
    api.get<{ success: boolean; data: SupplierCreditLine[] }>(`/suppliers/${supplierId}/credit-lines`),
  createCreditLine: (supplierId: string, data: { creditLimit: number; notes?: string }) =>
    api.post<{ success: boolean; data: SupplierCreditLine }>(`/suppliers/${supplierId}/credit-lines`, data),
  updateCreditLine: (supplierId: string, lineId: string, data: { creditLimit?: number; notes?: string }) =>
    api.put<{ success: boolean; data: SupplierCreditLine }>(`/suppliers/${supplierId}/credit-lines/${lineId}`, data),
  toggleCreditLine: (supplierId: string, lineId: string) =>
    api.patch<{ success: boolean; data: SupplierCreditLine }>(`/suppliers/${supplierId}/credit-lines/${lineId}/toggle`),
  getCreditLineBalance: (supplierId: string, lineId: string) =>
    api.get<{ success: boolean; data: { lineId: string; creditLimit: number; consumed: number; paid: number; pending: number; available: number } }>(`/suppliers/${supplierId}/credit-lines/${lineId}/balance`),
  addCreditPayment: (supplierId: string, lineId: string, data: { amount: number; paymentDate: string; paymentMethod: string; reference?: string; notes?: string }) =>
    api.post<{ success: boolean; data: SupplierCreditPayment }>(`/suppliers/${supplierId}/credit-lines/${lineId}/payments`, data),
  getCreditPayments: (supplierId: string, lineId: string) =>
    api.get<{ success: boolean; data: SupplierCreditPayment[] }>(`/suppliers/${supplierId}/credit-lines/${lineId}/payments`),
};

// ── Notificaciones in-app ─────────────────────────────────────
import type { AppNotification, NotificationContact } from '../types';

export const notificationsApi = {
  list:        () =>
    api.get<{ success: boolean; data: AppNotification[] }>('/notifications'),
  unreadCount: () =>
    api.get<{ success: boolean; data: { count: number } }>('/notifications/unread-count'),
  markRead:    (id: string) =>
    api.patch<{ success: boolean }>(`/notifications/${id}/read`),
  markAllRead: () =>
    api.patch<{ success: boolean }>('/notifications/read-all'),
  runChecks:   () =>
    api.post<{ success: boolean; message: string }>('/notifications/run-checks'),
  testWhatsApp: () =>
    api.post<{ success: boolean; message: string }>('/notifications/test-whatsapp'),
};

// ── Contactos de notificación externos ───────────────────────
export const notificationContactsApi = {
  list:   () =>
    api.get<{ success: boolean; data: NotificationContact[] }>('/notification-contacts'),
  create: (data: { name: string; phone?: string | null; email?: string | null; notifTypes?: string[] }) =>
    api.post<{ success: boolean; data: NotificationContact }>('/notification-contacts', data),
  update: (id: string, data: { name?: string; phone?: string | null; email?: string | null; isActive?: boolean; notifTypes?: string[] }) =>
    api.put<{ success: boolean; data: NotificationContact }>(`/notification-contacts/${id}`, data),
  remove: (id: string) =>
    api.delete(`/notification-contacts/${id}`),
};

// ── Monitoreo ─────────────────────────────────────────────────
export const monitoringApi = {
  dashboard: () =>
    api.get<{ success: boolean; data: MonitoringDashboard }>('/monitoring/dashboard'),
  logs: (params?: Record<string, unknown>) =>
    api.get<{ success: boolean; data: SystemLog[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/monitoring/logs', { params }),
  metrics: (hours?: number) =>
    api.get<{ success: boolean; data: MonitoringDashboard['metrics'] }>('/monitoring/metrics', { params: { hours } }),
  healthHistory: (hours?: number) =>
    api.get<{ success: boolean; data: { status: string; dbOk: boolean; memoryUsedPct: number; responseTime: number; createdAt: string }[] }>('/monitoring/health/history', { params: { hours } }),
  aiAnalyze: () =>
    api.post<{ success: boolean; data: AiAnalysisResult }>('/monitoring/ai-analyze'),
  subscriptions: () =>
    api.get('/monitoring/subscriptions'),
};

// ── Contratos Ajustados ───────────────────────────────────────
export const contratosAjustadosApi = {
  list:     (params?: Record<string, unknown>) =>
    api.get<any>('/contratos-ajustados', { params }),
  getById:  (id: string) =>
    api.get<{ success: boolean; data: any }>(`/contratos-ajustados/${id}`),
  create:   (data: unknown) =>
    api.post<{ success: boolean; data: any }>('/contratos-ajustados', data),
  update:   (id: string, data: unknown) =>
    api.put<{ success: boolean; data: any }>(`/contratos-ajustados/${id}`, data),
  remove:   (id: string) =>
    api.delete(`/contratos-ajustados/${id}`),
  resumen:  () =>
    api.get<{ success: boolean; data: any }>('/contratos-ajustados/resumen'),
  availableExpenses: (id: string) =>
    api.get<{ success: boolean; data: any[] }>(`/contratos-ajustados/${id}/available-expenses`),
  linkExpense:   (id: string, expenseId: string) =>
    api.post<{ success: boolean; data: any }>(`/contratos-ajustados/${id}/link-expense`, { expenseId }),
  unlinkExpense: (id: string, expenseId: string) =>
    api.post<{ success: boolean; data: any }>(`/contratos-ajustados/${id}/unlink-expense`, { expenseId }),
  createAdenda: (id: string, data: { monto: number; descripcion: string; fecha: string }) =>
    api.post<{ success: boolean; data: any }>(`/contratos-ajustados/${id}/adendas`, data),
  deleteAdenda: (id: string, adendaId: string) =>
    api.delete<{ success: boolean; data: any }>(`/contratos-ajustados/${id}/adendas/${adendaId}`),
};

// ── Suscripciones de Servicios ────────────────────────────────
export const serviceSubscriptionsApi = {
  overview:  () =>
    api.get<{ success: boolean; data: import('../types').SubscriptionsOverview }>('/monitoring/subscriptions'),
  list:      () =>
    api.get<{ success: boolean; data: import('../types').ServiceSubscription[] }>('/service-subscriptions'),
  create:    (d: unknown) =>
    api.post<{ success: boolean; data: import('../types').ServiceSubscription }>('/service-subscriptions', d),
  update:    (id: string, d: unknown) =>
    api.put<{ success: boolean; data: import('../types').ServiceSubscription }>(`/service-subscriptions/${id}`, d),
  remove:    (id: string) =>
    api.delete(`/service-subscriptions/${id}`),
  exportCsv: () =>
    api.get('/service-subscriptions/export/csv', { responseType: 'blob' }),
};
