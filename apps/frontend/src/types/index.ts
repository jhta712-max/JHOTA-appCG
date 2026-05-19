export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: { name: string; description: string };
  isActive: boolean;
  lastLogin?: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  estimatedBudget: number;
  notes?: string;
  createdBy: { id: string; name: string };
  _count?: { expenses: number };
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface FiscalVoucher {
  id: string;
  ncf: string;
  ncfType: string;
  isElectronic: boolean;
  supplierRnc: string;
  supplierName: string;
  itbisAmount: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  expenseDate: string;
  amount: number;
  description: string;
  paymentMethod: 'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER';
  hasFiscalDoc: boolean;
  status: 'ACTIVE' | 'VOIDED';
  notes?: string;
  project: { id: string; code: string; name: string };
  projectId: string;
  category: { id: number; name: string; icon?: string };
  registeredBy: { id: string; name: string };
  fiscalVoucher?: FiscalVoucher;
  attachments: Attachment[];
  createdAt: string;
  voidedAt?: string;
  voidReason?: string;
}

export interface Addendum {
  id: string;
  number: number;
  amount: number;
  description: string;
  date: string;
  createdBy?: { id: string; name: string };
  createdAt?: string;
}

export interface ProjectSummary {
  project: {
    id: string; code: string; name: string; status: string;
    estimatedBudget: number; addendumTotal: number; totalBudget: number;
  };
  summary: {
    totalSpent: number;
    budgetRemaining: number;
    budgetUsedPct: number;
    expenseCount: number;
  };
  addendums: Addendum[];
  byCategory: Array<{
    category: { id: number; name: string; icon?: string };
    totalAmount: number;
    expenseCount: number;
  }>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface Assignment {
  id: string;
  projectId: string;
  userId: string;
  user: { id: string; name: string; email: string };
  assignedBy: { id: string; name: string };
  createdAt: string;
}

export interface Cubicacion {
  id: string;
  number: number;
  amount: number;
  progressPct: number;
  description: string;
  date: string;
  createdBy?: { id: string; name: string };
  createdAt?: string;
}

export interface FinancialAnalysis {
  project: {
    id: string; code: string; name: string;
    estimatedBudget: number; addendumTotal: number; totalBudget: number;
  };
  financials: {
    totalCubicado: number;
    totalGastado: number;
    margen: number;
    margenPct: number;
    lastProgressPct: number;
    expenseCount: number;
  };
  cubicaciones: Cubicacion[];
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH:     'Efectivo',
  TRANSFER: 'Transferencia',
  CARD:     'Tarjeta',
  CHECK:    'Cheque',
  OTHER:    'Otro',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE:    'Activo',
  PAUSED:    'Pausado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};
