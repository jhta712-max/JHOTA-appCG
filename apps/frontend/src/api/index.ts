import api from './client';
import type { Project, Expense, Category, ProjectSummary, PaginatedResponse, User, Addendum, Cubicacion, FinancialAnalysis, Assignment } from '../types';

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
  // Asignaciones de operadores
  getAssignments:  (projectId: string) =>
    api.get<{ success: boolean; data: Assignment[] }>(`/projects/${projectId}/assignments`),
  assignUser:      (projectId: string, userId: string) =>
    api.post<{ success: boolean; data: Assignment }>(`/projects/${projectId}/assignments`, { userId }),
  unassignUser:    (projectId: string, userId: string) =>
    api.delete(`/projects/${projectId}/assignments/${userId}`),
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
  uploadAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/expenses/${id}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
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
  bankName:     string | null;
  bankAccount:  string | null;
  createdAt:    string;
  updatedAt:    string;
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
  lines?:      PayrollLine[];
  expense?:    { id: string; amount: number; expenseDate: string; description: string } | null;
  _count?:     { lines: number };
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

export const ocrApi = {
  analyze: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<{ success: boolean; data: OcrResult }>(
      '/ocr/analyze',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
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
};
