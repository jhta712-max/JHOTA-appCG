import React, { useState, useRef } from 'react';
import { SavedFiltersBar } from '../../components/ui/SavedFiltersBar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QuickCreateSupplierModal from '../../components/suppliers/QuickCreateSupplierModal';
import {
  FileText, Plus, CheckCircle, AlertCircle, Loader2,
  Pencil, ClipboardCopy, Copy, X,
  BadgeCheck, Clock, Wallet, Link, Unlink, ShoppingCart,
  MessageCircle, Sparkles, Camera, ArrowRight, RotateCcw,
} from 'lucide-react';
import { paymentOrdersApi, projectsApi, payrollApi, suppliersApi, usersApi } from '../../api';
import { useOcrPolling } from '../../hooks/useOcrPolling';
import { useAuthStore } from '../../stores/authStore';
import type { PaymentOrder, Supplier, SupplierBankAccount } from '../../types';
import { FiscalVoucherForm, type FiscalVoucherValue } from '../../components/shared/FiscalVoucherForm';
import { BatchItemSelect } from '../../components/shared/BatchItemSelect';
import { TransferPaymentForm } from '../../components/shared/TransferPaymentForm';
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';

type OrderType = 'SERVICIO' | 'PAYROLL' | 'MATERIALS' | 'PETTY_CASH';
type ModalView = 'form' | 'success';

type OrderForm = {
  orderType: OrderType; payingCompany: string; supplierId: string;
  projectId: string; amount: string; currency: string; concept: string;
  notes: string; payrollId: string; bankAccountId: string; contratoAjustadoId: string; quotationId: string;
  payrollPeriodStart: string; payrollPeriodEnd: string; payrollType: 'LABOR' | 'SERVICE';
  batchItemId: string; creditLineId: string | null;
};
const EMPTY_ORDER: OrderForm = {
  orderType: 'SERVICIO', payingCompany: '', supplierId: '', projectId: '',
  amount: '', currency: 'RD$', concept: '', notes: '', payrollId: '', bankAccountId: '', contratoAjustadoId: '', quotationId: '',
  payrollPeriodStart: '', payrollPeriodEnd: '', payrollType: 'LABOR',
  batchItemId: '', creditLineId: null,
};

const CURRENCIES = ['RD$', 'US$', '€'];

const NCF_REGEX   = /^[A-Z]\d{10}$/;
const E_NCF_REGEX = /^E\d{12}$/;
const validateNcf = (v: string) => NCF_REGEX.test(v) || E_NCF_REGEX.test(v);

const ORDER_TYPE_CFG: Record<OrderType, { label: string; icon: React.ReactNode; desc: string; dark: string }> = {
  SERVICIO:   { label: 'Servicio',    icon: <FileText className="w-4 h-4" />,     desc: 'Pago por servicios',                 dark: 'border-purple-500' },
  PAYROLL:    { label: 'Nómina',      icon: <Wallet className="w-4 h-4" />,       desc: 'Pago de mano de obra',               dark: 'border-blue-400'   },
  MATERIALS:  { label: 'Materiales',  icon: <ShoppingCart className="w-4 h-4" />, desc: 'Compra de insumos por transferencia',dark: 'border-[#F5C218]'  },
  PETTY_CASH: { label: 'Caja chica',  icon: <Sparkles className="w-4 h-4" />,     desc: 'Pagos menores en efectivo',          dark: 'border-green-500'  },
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:       { label: 'Pendiente',    cls: 'bg-amber-100 text-amber-700',   icon: <Clock className="w-3 h-3" /> },
  IN_PROCESS:    { label: 'En proceso',   cls: 'bg-blue-100 text-blue-700',     icon: <ArrowRight className="w-3 h-3" /> },
  REJECTED_BANK: { label: 'Rechazada banco', cls: 'bg-orange-100 text-orange-700', icon: <RotateCcw className="w-3 h-3" /> },
  PAID:          { label: 'Pagada',       cls: 'bg-green-100 text-green-700',   icon: <BadgeCheck className="w-3 h-3" /> },
  VOIDED:        { label: 'Anulada',      cls: 'bg-gray-100 text-gray-500',     icon: <X className="w-3 h-3" /> },
};

const PAYROLL_TYPE_LABEL: Record<string, string> = { LABOR: 'Mano de obra', SERVICE: 'Servicios' };

function fmtMonto(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtAmountInput(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, '');
  const parts  = clean.split('.');
  const int    = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${int}.${parts[1].slice(0, 2)}` : int;
}
function parseAmountInput(formatted: string): string { return formatted.replace(/,/g, ''); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeAccountType(raw: string): 'Cuenta de Ahorros' | 'Cuenta Corriente' | 'Cuenta Nómina' {
  const v = raw.toLowerCase().trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
  if (v.includes('corriente')) return 'Cuenta Corriente';
  if (v.includes('nomina'))    return 'Cuenta Nómina';
  return 'Cuenta de Ahorros';
}

const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function shareWhatsApp(text: string, onCopied?: () => void) {
  const encoded = encodeURIComponent(text);
  if (isMobileDevice()) { window.open(`whatsapp://send?text=${encoded}`, '_blank'); }
  else { window.open(`https://wa.me/?text=${encoded}`, '_blank'); onCopied?.(); }
}

// ── Sub-components ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: any }) {
  const normalized: OrderType = ['SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH'].includes(type) ? type : 'SERVICIO';
  const cls: Record<OrderType, string> = {
    SERVICIO:   'bg-purple-100 text-purple-700',
    PAYROLL:    'bg-blue-100 text-blue-700',
    MATERIALS:  'bg-amber-100 text-amber-700',
    PETTY_CASH: 'bg-green-100 text-green-700',
  };
  return <span className={`inline-flex px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${cls[normalized]}`}>{ORDER_TYPE_CFG[normalized].label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function AlertBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border-l-4 border-red-500 p-3 mb-4">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-600">{msg}</p>
    </div>
  );
}

function Modal({ title, onClose, wide = false, size, children }: {
  title: string; onClose: () => void; wide?: boolean; size?: string; children: React.ReactNode;
}) {
  const maxW = wide ? 'max-w-2xl' : size === 'md' ? 'max-w-lg' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className={`bg-white w-full ${maxW} max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="bg-[#1C1C1C] flex items-center justify-between px-6 py-4">
          <h2 className="font-black text-white font-['Barlow_Condensed'] text-xl uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, label }: { onCancel: () => void; onSave: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 mt-4 justify-end border-t border-gray-100 pt-4">
      <button onClick={onCancel}
        className="px-4 py-2.5 text-sm font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors uppercase tracking-wide">
        Cancelar
      </button>
      <button onClick={onSave} disabled={saving}
        className="bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-yellow-300 transition-colors disabled:opacity-50 flex items-center gap-2">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><CheckCircle className="w-4 h-4" /> {label}</>}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
export default function PaymentOrdersPage() {
  const qc        = useQueryClient();
  const authUser  = useAuthStore((s) => s.user);
  const userRole  = authUser?.role?.name ?? '';
  const isAdmin   = userRole === 'admin';
  const isAuxiliar = userRole === 'auxiliar';
  const isFinanciero = userRole === 'financiero';
  const canFilterStatus = isAdmin || isFinanciero || isAuxiliar;
  const [viewingOrder, setViewingOrder] = useState<PaymentOrder | null>(null);
  const [toast,        setToast]        = useState('');
  const [filterStatus,    setFilterStatus]    = useState('');
  const [filterType,      setFilterType]      = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');

  const [orderModal,       setOrderModal]       = useState(false);
  const [linkModal,        setLinkModal]         = useState(false);
  const [linkPayrollModal, setLinkPayrollModal]  = useState(false);

  const [modalView,        setModalView]        = useState<ModalView>('form');
  const [lastCreatedOrder, setLastCreatedOrder] = useState<PaymentOrder | null>(null);
  const [sessionOrders,    setSessionOrders]    = useState<PaymentOrder[]>([]);

  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PaymentOrder | null>(null);
  const [orderForm,    setOrderForm]    = useState<OrderForm>(EMPTY_ORDER);
  const [formErr,      setFormErr]      = useState('');
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [selectedPayrollId, setSelectedPayrollId] = useState('');
  const [supplierSearch,    setSupplierSearch]    = useState('');
  const [linkToCreditLine,  setLinkToCreditLine]  = useState(false);
  const [creditLineSupplierId, setCreditLineSupplierId] = useState('');

  const [payModal,     setPayModal]     = useState(false);
  const [payingOrder,  setPayingOrder]  = useState<PaymentOrder | null>(null);
  const [fiscalForm,   setFiscalForm]   = useState<FiscalVoucherValue>({ hasFiscal: false, ncf: '', supplierRnc: '', supplierName: '', itbisAmount: '' });
  const [payInfoForm,  setPayInfoForm]  = useState({ paymentBank: '', paymentReference: '', exchangeRate: '' });
  const [fiscalErr,    setFiscalErr]    = useState('');
  const [conceptLoading, setConceptLoading] = useState(false);
  const { loading: ocrPayLoading, error: ocrPayError, analyze: runOcrPay, reset: resetOcrPay } = useOcrPolling();
  const [ocrPayValidated, setOcrPayValidated] = useState(false);
  const ocrPayInputRef = useRef<HTMLInputElement>(null);

  const openPayModal = (o: PaymentOrder) => {
    resetOcrPay(); setOcrPayValidated(false); setPayingOrder(o);
    setFiscalForm({ hasFiscal: false, ncf: '', supplierRnc: o.supplier?.rnc ?? '', supplierName: o.supplier?.name ?? '', itbisAmount: '' });
    setPayInfoForm({ paymentBank: '', paymentReference: '', exchangeRate: '' });
    setFiscalErr(''); setPayModal(true);
  };
  const closePayModal = () => { setPayModal(false); setPayingOrder(null); };

  const handleOcrPayScan = async (file: File) => {
    const data = await runOcrPay(file);
    if (!data) return;
    if (data.ncf || data.supplierName || data.supplierRnc || data.itbisAmount !== null) {
      setFiscalForm((v) => ({
        hasFiscal: true,
        ncf:          data.ncf          ?? v.ncf,
        supplierRnc:  data.supplierRnc  ?? v.supplierRnc,
        supplierName: data.supplierName ?? v.supplierName,
        itbisAmount:  data.itbisAmount != null ? String(data.itbisAmount) : v.itbisAmount,
      }));
    }
  };

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleSuggestConcept = async () => {
    setConceptLoading(true);
    try {
      const supplier = activeSuppliers.find((s) => s.id === orderForm.supplierId);
      const project  = projects.find((p) => p.id === orderForm.projectId);
      const res = await paymentOrdersApi.suggestConcept({
        orderType: orderForm.orderType, supplierName: supplier?.name,
        projectCode: project?.code, projectName: project?.name,
        amount: orderForm.amount ? parseFloat(orderForm.amount.replace(/,/g, '')) : undefined,
        currency: orderForm.currency,
      });
      setOrderForm((f) => ({ ...f, concept: res.data.data.concept }));
    } catch { /* silencioso */ } finally { setConceptLoading(false); }
  };

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['payment-orders', filterStatus, filterType, filterCreatedBy],
    queryFn:  () => paymentOrdersApi.list({
      ...(filterStatus    ? { status:      filterStatus    } : {}),
      ...(filterType      ? { orderType:   filterType      } : {}),
      ...(filterCreatedBy ? { createdById: filterCreatedBy } : {}),
    }),
    select: (r) => (r.data as any).data as PaymentOrder[],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => usersApi.list(),
    select:   (r) => r.data.data as { id: string; name: string; role?: { name: string } }[],
    enabled:  isAdmin,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'active'],
    queryFn:  () => projectsApi.list({ status: 'ACTIVE', limit: 100 }),
    select:   (r) => r.data.data,
  });

  const { data: activeSuppliers = [] } = useQuery({
    queryKey: ['suppliers', 'active-with-bank', isAdmin ? 'all' : (orderForm.projectId || 'none')],
    queryFn:  () => {
      const projectId = orderForm.projectId || undefined;
      if (!isAdmin && projectId) {
        return suppliersApi.list({ onlyActive: true, projectId });
      }
      return suppliersApi.list({ onlyActive: true });
    },
    select:   (r) => r.data.data as Supplier[],
    enabled:  orderModal,
  });

  const linkingOrderProjectId = viewingOrder?.projectId ?? '';

  const { data: projectPayrolls = [] } = useQuery({
    queryKey: ['payrolls', 'by-project', linkingOrderProjectId],
    queryFn:  () => payrollApi.list({ projectId: linkingOrderProjectId, limit: 50 }),
    select:   (r) => r.data.data as any[],
    enabled:  linkPayrollModal && !!linkingOrderProjectId,
  });
  const { data: availableExpenses = [] } = useQuery({
    queryKey: ['payment-orders', 'expenses', linkingOrderProjectId],
    queryFn:  () => paymentOrdersApi.availableExpenses(linkingOrderProjectId),
    select:   (r) => r.data.data,
    enabled:  linkModal && !!linkingOrderProjectId,
  });
  const { data: availableContracts = [] } = useQuery({
    queryKey: ['payment-orders', 'contracts', orderForm.projectId, orderForm.supplierId],
    queryFn:  () => paymentOrdersApi.availableContracts(orderForm.projectId, orderForm.supplierId),
    select:   (r) => r.data.data as any[],
    enabled:  orderModal && !!orderForm.projectId && !!orderForm.supplierId,
    staleTime: 0,
  });
  const { data: availableQuotations = [] } = useQuery({
    queryKey: ['payment-orders', 'quotations', orderForm.projectId, orderForm.supplierId],
    queryFn:  () => paymentOrdersApi.availableQuotations(orderForm.projectId, orderForm.supplierId),
    select:   (r) => r.data.data as any[],
    enabled:  orderModal && orderForm.orderType === 'SERVICIO' && !!orderForm.projectId,
  });
  const { data: selectedSupplierCreditLines } = useQuery({
    queryKey: ['supplierCreditLines', orderForm.supplierId],
    queryFn:  () => suppliersApi.getCreditLines(orderForm.supplierId),
    enabled:  orderModal && !!orderForm.supplierId,
    select:   (r) => (r.data.data as any[]).filter((l: any) => l.isActive),
  });
  const supplierHasCreditLines = (selectedSupplierCreditLines?.length ?? 0) > 0;

  const { data: creditLinesData } = useQuery({
    queryKey: ['supplierCreditLines', creditLineSupplierId],
    queryFn:  () => suppliersApi.getCreditLines(creditLineSupplierId),
    enabled:  linkToCreditLine && !!creditLineSupplierId,
    select:   (r) => r.data.data as any[],
  });

  const createOrderMut = useMutation({
    mutationFn: (d: unknown) => paymentOrdersApi.create(d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
      const newOrder = res.data.data as PaymentOrder;
      setLastCreatedOrder(newOrder); setSessionOrders((prev) => [...prev, newOrder]);
      setViewingOrder(newOrder); setModalView('success'); flash('✅ Orden generada');
    },
    onError: (e: any) => setFormErr(e.response?.data?.error || 'Error al crear'),
  });
  const updateOrderMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: unknown }) => paymentOrdersApi.update(id, d),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); closeOrderModal(); flash('✅ Orden actualizada'); setViewingOrder(res.data.data); },
    onError:   (e: any) => setFormErr(e.response?.data?.error || 'Error'),
  });
  const markPaidMut = useMutation({
    mutationFn: ({ id, fiscalVoucher, paymentInfo }: {
      id: string;
      fiscalVoucher?: { ncf: string; supplierRnc: string; supplierName: string; itbisAmount?: number } | null;
      paymentInfo?:   { paymentBank?: string; paymentReference?: string } | null;
    }) => paymentOrdersApi.markAsPaid(id, fiscalVoucher, paymentInfo),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); closePayModal(); flash('✅ Orden marcada como pagada'); },
    onError:   (e: any) => setFiscalErr(e.response?.data?.error || 'Error al confirmar pago'),
  });
  const voidOrderMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.void(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); flash('Orden anulada'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error'),
  });
  const generateExpenseMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.generateExpense(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); flash('✅ Gasto generado y vinculado al proyecto'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error al generar gasto'),
  });
  const linkExpenseMut = useMutation({
    mutationFn: ({ id, expenseId }: { id: string; expenseId: string }) => paymentOrdersApi.linkExpense(id, expenseId),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); setLinkModal(false); flash('✅ Gasto vinculado'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error'),
  });
  const unlinkExpenseMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.unlinkExpense(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); flash('Gasto desvinculado'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error'),
  });
  const linkPayrollMut = useMutation({
    mutationFn: ({ id, payrollId }: { id: string; payrollId: string }) => paymentOrdersApi.linkPayroll(id, payrollId),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); setLinkPayrollModal(false); setSelectedPayrollId(''); flash('✅ Nómina vinculada'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error al vincular nómina'),
  });
  const unlinkPayrollMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.unlinkPayroll(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); flash('Nómina desvinculada'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error'),
  });
  const hardDeleteOrderMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.hardDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(null); flash('🗑 Orden eliminada permanentemente'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error al eliminar'),
  });
  const revertToPendingMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.revertToPending(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); flash('↩️ Orden revertida a Pendiente'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error al revertir'),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => paymentOrdersApi.updateStatus(id, status),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); flash('Estado actualizado'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error al actualizar estado'),
  });

  const normalizeOrderType = (type: any): OrderType => {
    if (type === 'GENERAL') return 'SERVICIO';
    if (['SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH'].includes(type)) return type;
    return 'SERVICIO';
  };

  const openOrderModal = (o?: PaymentOrder) => {
    setEditingOrder(o ?? null);
    const payroll = (o as any)?.payroll;
    setOrderForm(o ? {
      orderType:          normalizeOrderType(o.orderType),
      payingCompany:      o.payingCompany,
      supplierId:         o.supplierId,
      projectId:          o.projectId,
      amount:             String(o.amount),
      currency:           o.currency,
      concept:            o.concept,
      notes:              o.notes ?? '',
      payrollId:          o.payrollId ?? '',
      bankAccountId:      '',
      contratoAjustadoId: (o as any).contratoAjustadoId ?? '',
      quotationId:        (o as any).quotationId ?? '',
      payrollPeriodStart: payroll?.periodStart ? payroll.periodStart.slice(0, 10) : '',
      payrollPeriodEnd:   payroll?.periodEnd   ? payroll.periodEnd.slice(0, 10)   : '',
      payrollType:        payroll?.type ?? 'LABOR',
      batchItemId:      (o as any).batchItemId ?? '',
      creditLineId:     (o as any).creditLineId ?? null,
    } : EMPTY_ORDER);
    setModalView('form'); setSessionOrders([]); setLastCreatedOrder(null); setFormErr(''); setOrderModal(true);
  };

  const closeOrderModal = () => {
    setOrderModal(false); setEditingOrder(null); setOrderForm(EMPTY_ORDER);
    setFormErr(''); setModalView('form'); setSessionOrders([]); setLastCreatedOrder(null);
    setLinkToCreditLine(false); setCreditLineSupplierId('');
  };

  const crearOtraOrden = () => {
    setOrderForm((f) => ({ ...EMPTY_ORDER, payingCompany: f.payingCompany, projectId: f.projectId }));
    setFormErr(''); setModalView('form');
  };

  const saveOrder = () => {
    if (!orderForm.payingCompany.trim()) return setFormErr('La empresa pagadora es requerida');
    if (!orderForm.supplierId)           return setFormErr('Selecciona un suplidor / beneficiario');
    if (!orderForm.projectId)            return setFormErr('Selecciona un proyecto');
    if (!orderForm.amount || Number(orderForm.amount) <= 0) return setFormErr('El monto debe ser mayor a 0');
    if (!orderForm.concept.trim())       return setFormErr('El concepto es requerido');

    const isNewPayroll = orderForm.orderType === 'PAYROLL' && !editingOrder;
    if (isNewPayroll) {
      if (!orderForm.payrollPeriodStart) return setFormErr('La fecha de inicio del período es requerida');
      if (!orderForm.payrollPeriodEnd)   return setFormErr('La fecha de fin del período es requerida');
      if (orderForm.payrollPeriodEnd < orderForm.payrollPeriodStart)
        return setFormErr('La fecha fin debe ser posterior a la fecha inicio');
    }

    const payload: any = {
      orderType:          orderForm.orderType,
      payingCompany:      orderForm.payingCompany,
      supplierId:         orderForm.supplierId,
      projectId:          orderForm.projectId,
      amount:             Number(orderForm.amount),
      currency:           orderForm.currency,
      concept:            orderForm.concept,
      notes:              orderForm.notes || undefined,
      bankAccountId:      orderForm.bankAccountId || undefined,
      contratoAjustadoId: orderForm.contratoAjustadoId || undefined,
      quotationId:        orderForm.orderType === 'SERVICIO' ? (orderForm.quotationId || undefined) : undefined,
      batchItemId:      orderForm.batchItemId || undefined,
      creditLineId:     linkToCreditLine ? (orderForm.creditLineId || undefined) : undefined,
    };

    if (isNewPayroll) {
      payload.payrollData = { periodStart: orderForm.payrollPeriodStart, periodEnd: orderForm.payrollPeriodEnd, type: 'LABOR' };
    }

    if (editingOrder) updateOrderMut.mutate({ id: editingOrder.id, d: payload });
    else              createOrderMut.mutate(payload);
  };

  const copyText = (text: string) => { navigator.clipboard.writeText(text).then(() => flash('📋 Texto copiado')); };

  const cloneOrder = (o: PaymentOrder) => {
    const payroll = (o as any)?.payroll;
    setEditingOrder(null);
    setOrderForm({
      orderType:          normalizeOrderType(o.orderType),
      payingCompany:      o.payingCompany,
      supplierId:         o.supplierId,
      projectId:          o.projectId,
      amount:             String(o.amount),
      currency:           o.currency,
      concept:            o.concept,
      notes:              o.notes ?? '',
      payrollId:          '',
      bankAccountId:      '',
      contratoAjustadoId: (o as any).contratoAjustadoId ?? '',
      quotationId:        (o as any).quotationId ?? '',
      payrollPeriodStart: '',
      payrollPeriodEnd:   '',
      payrollType:        payroll?.type ?? 'LABOR',
      batchItemId:        '',
      creditLineId:       null,
    });
    setModalView('form'); setSessionOrders([]); setLastCreatedOrder(null); setFormErr(''); setOrderModal(true);
  };

  return (
    <div className="font-['DM_Sans'] space-y-0">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C1C1C] text-[#F5C218] px-5 py-2.5 text-sm font-bold shadow-lg border-l-4 border-[#F5C218] font-['Space_Mono']">
          {toast}
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-[#1C1C1C] px-6 py-8 mb-6">
        <div className="flex items-end justify-between max-w-5xl">
          <div>
            <p className="text-[#F5C218] text-xs font-bold tracking-[0.2em] uppercase font-['Space_Mono'] mb-2">
              MÓDULO / ÓRDENES DE PAGO
            </p>
            <h1 className="text-4xl font-black text-white font-['Barlow_Condensed'] uppercase tracking-tight leading-none">
              ÓRDENES DE PAGO
            </h1>
            <p className="text-gray-400 text-sm mt-2">Solicitudes de pago vía transferencia · Nómina · Materiales · General</p>
          </div>
          <button
            onClick={() => openOrderModal()}
            className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-5 py-3 font-bold text-sm uppercase tracking-wide hover:bg-yellow-300 transition-colors">
            <Plus className="w-4 h-4" /> Nueva orden
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 space-y-5">

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {canFilterStatus && (['', 'PENDING', 'IN_PROCESS', 'REJECTED_BANK', 'PAID'] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide border transition-all ${
                filterStatus === s
                  ? 'bg-[#1C1C1C] text-[#F5C218] border-[#1C1C1C]'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>
              {s === '' ? 'Todas' : s === 'PENDING' ? 'Pendientes' : s === 'IN_PROCESS' ? 'En proceso' : s === 'REJECTED_BANK' ? 'Rechazadas' : 'Pagadas'}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1 self-stretch" />
          {(['', 'SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH'] as const).map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide border transition-all ${
                filterType === t
                  ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
              }`}>
              {t === '' ? 'Todos tipos' : ORDER_TYPE_CFG[t as OrderType].label}
            </button>
          ))}
          {isAdmin && allUsers.length > 0 && (
            <>
              <div className="w-px bg-gray-200 mx-1 self-stretch" />
              <select
                value={filterCreatedBy}
                onChange={(e) => setFilterCreatedBy(e.target.value)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide border transition-all font-['Barlow_Condensed'] focus:outline-none focus:border-[#1C1C1C] ${
                  filterCreatedBy
                    ? 'bg-[#1C1C1C] text-[#F5C218] border-[#1C1C1C]'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                <option value="">Todos los usuarios</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </>
          )}
          {orders.filter((o) => o.generatedText).length > 1 && (
            <>
              <div className="w-px bg-gray-200 mx-1 self-stretch" />
              <button
                onClick={() => copyText(orders.filter((o) => o.generatedText).map((o, i) => `${i + 1}. ${o.generatedText}`).join('\n\n─────────────\n\n'))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-all uppercase tracking-wide">
                <ClipboardCopy className="w-3.5 h-3.5" /> Copiar todas
              </button>
              <button
                onClick={() => shareWhatsApp(orders.filter((o) => o.generatedText).map((o, i) => `${i + 1}. ${o.generatedText}`).join('\n\n─────────────\n\n'), () => flash('📋 Copiado — pega en WhatsApp Web'))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-all uppercase tracking-wide">
                <MessageCircle className="w-3.5 h-3.5" /> Compartir todas
              </button>
            </>
          )}
        </div>

        {/* Vistas guardadas */}
        <SavedFiltersBar
          namespace="payment-orders"
          currentFilters={{ filterStatus, filterType, filterCreatedBy }}
          onApply={(f: any) => {
            if (f.filterStatus    !== undefined) setFilterStatus(f.filterStatus);
            if (f.filterType      !== undefined) setFilterType(f.filterType);
            if (f.filterCreatedBy !== undefined) setFilterCreatedBy(f.filterCreatedBy);
          }}
        />

        {/* Detalle expandido */}
        {viewingOrder && (
          <div className="bg-white border-l-4 border-[#F5C218] border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 font-['Space_Mono'] font-bold">OP-{String(viewingOrder.number).padStart(3, '0')}</span>
                  <TypeBadge type={viewingOrder.orderType} />
                  <StatusBadge status={viewingOrder.status} />
                </div>
                <p className="font-black text-[#1C1C1C] mt-1 text-base font-['Barlow_Condensed'] text-xl uppercase tracking-wide">{viewingOrder.payingCompany}</p>
                <p className="text-sm text-gray-500 mt-0.5">{viewingOrder.concept}</p>
                <p className="text-xl font-black text-[#1C1C1C] mt-1 font-['Space_Mono']">{fmtMonto(viewingOrder.amount, viewingOrder.currency)}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-['Space_Mono']">
                  <span className="font-bold">{viewingOrder.project.code}</span>
                  {' — '}{viewingOrder.project.name}
                </p>
              </div>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {/* Vínculo nómina */}
            {viewingOrder.orderType === 'PAYROLL' && (
              <div className={`p-3 border text-sm ${viewingOrder.payroll ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide font-['Space_Mono']">Nómina vinculada</p>
                  {viewingOrder.status !== 'VOIDED' && !viewingOrder.payroll && (
                    <button onClick={() => setLinkPayrollModal(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold border border-blue-300 px-2 py-0.5 uppercase tracking-wide">
                      + Vincular nómina existente
                    </button>
                  )}
                </div>
                {viewingOrder.payroll ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-blue-800">
                        {PAYROLL_TYPE_LABEL[viewingOrder.payroll.type]} #{viewingOrder.payroll.number}
                      </p>
                      <span className={`px-2 py-0.5 text-xs font-bold uppercase ${
                        viewingOrder.payroll.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        viewingOrder.payroll.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'}`}>
                        {viewingOrder.payroll.status}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 font-['Space_Mono']">
                      Período: {fmtDate(viewingOrder.payroll.periodStart)} — {fmtDate(viewingOrder.payroll.periodEnd)}
                      &nbsp;·&nbsp; {fmtMonto(viewingOrder.payroll.totalAmount, viewingOrder.currency)}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">Sin nómina vinculada</p>
                )}
              </div>
            )}

            {/* Vínculo gasto — materiales */}
            {viewingOrder.orderType === 'MATERIALS' && (
              <div className={`p-3 border text-sm ${viewingOrder.expense ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide font-['Space_Mono']">Gasto vinculado</p>
                  {viewingOrder.status !== 'VOIDED' && (
                    viewingOrder.expense
                      ? <button onClick={() => { if (confirm('¿Desvincular gasto?')) unlinkExpenseMut.mutate(viewingOrder.id); }}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-bold uppercase tracking-wide">
                          <Unlink className="w-3 h-3" /> Desvincular
                        </button>
                      : <button onClick={() => { setSelectedExpenseId(''); setLinkModal(true); }}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-bold uppercase tracking-wide">
                          <Link className="w-3 h-3" /> Vincular gasto
                        </button>
                  )}
                </div>
                {viewingOrder.expense ? (
                  <div>
                    <p className="font-bold text-amber-800">{viewingOrder.expense.description}</p>
                    <p className="text-xs text-amber-600 mt-0.5 font-['Space_Mono']">
                      {fmtMonto(viewingOrder.expense.amount, viewingOrder.currency)}
                      &nbsp;·&nbsp; {fmtDate(viewingOrder.expense.expenseDate)}
                      <span className={`ml-2 px-1.5 py-0.5 text-xs font-bold ${viewingOrder.expense.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {viewingOrder.expense.status}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">Sin gasto vinculado — se vincula cuando se confirme la transferencia</p>
                )}
              </div>
            )}

            {/* Contrato ajustado vinculado */}
            {(viewingOrder as any).contratoAjustado && (
              <div className="bg-indigo-50 border border-indigo-200 p-3 text-sm">
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-1 font-['Space_Mono']">Contrato ajustado vinculado</p>
                <p className="font-bold text-indigo-800">{(viewingOrder as any).contratoAjustado.descripcionTrabajo}</p>
                <p className="text-xs text-indigo-600 mt-0.5 font-['Space_Mono']">
                  Monto: {fmtMonto((viewingOrder as any).contratoAjustado.montoContratado, viewingOrder.currency)}
                  &nbsp;·&nbsp; Estado: {(viewingOrder as any).contratoAjustado.estado}
                </p>
              </div>
            )}

            {/* Mensaje WhatsApp */}
            {viewingOrder.generatedText && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 font-['Space_Mono']">Mensaje WhatsApp</p>
                <div className="bg-[#1C1C1C] text-gray-100 p-4 font-['Space_Mono'] text-xs whitespace-pre-wrap leading-relaxed">
                  {viewingOrder.generatedText}
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button onClick={() => copyText(viewingOrder.generatedText!)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wide">
                    <ClipboardCopy className="w-4 h-4" /> Copiar
                  </button>
                  <button
                    onClick={() => shareWhatsApp(viewingOrder.generatedText!, () => flash('📋 Copiado — pega en WhatsApp Web'))}
                    className="flex items-center gap-2 px-3 py-2 border border-green-300 text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 uppercase tracking-wide">
                    <MessageCircle className="w-4 h-4" /> Compartir por WhatsApp
                  </button>
                </div>
              </div>
            )}

            {/* Revertir / Eliminar */}
            {isAdmin && viewingOrder.status === 'PAID' && viewingOrder.expense?.status === 'REJECTED' && (
              <div className="pt-2 border-t border-orange-100">
                <button
                  onClick={() => { if (confirm('¿Revertir esta orden a PENDIENTE?')) revertToPendingMut.mutate(viewingOrder.id); }}
                  disabled={revertToPendingMut.isPending}
                  className="w-full text-xs text-orange-700 font-bold border border-orange-300 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 uppercase tracking-wide flex items-center justify-center gap-1.5">
                  ↩️ Revertir a Pendiente (gasto rechazado)
                </button>
              </div>
            )}
            {isAdmin && (
              <div className="pt-2 border-t border-red-100">
                <button
                  onClick={() => { if (confirm('⚠️ ¿ELIMINAR esta orden PERMANENTEMENTE?')) hardDeleteOrderMut.mutate(viewingOrder.id); }}
                  disabled={hardDeleteOrderMut.isPending}
                  className="w-full text-xs text-red-700 font-bold border border-red-300 bg-red-50 hover:bg-red-100 px-3 py-1.5 uppercase tracking-wide">
                  🗑 Eliminar permanentemente (Admin)
                </button>
              </div>
            )}

            {/* Comprobante de transferencia */}
            {viewingOrder.status === 'PAID' && (viewingOrder.paymentReference || viewingOrder.paymentBank) && (
              <div className="bg-green-50 border-l-4 border-green-500 p-3 text-sm space-y-1">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide font-['Space_Mono'] mb-1">Transferencia</p>
                {viewingOrder.paymentReference && (
                  <p className="text-gray-700">
                    <span className="font-bold text-gray-500 uppercase text-xs">No. transacción:</span>{' '}
                    <span className="font-['Space_Mono']">{viewingOrder.paymentReference}</span>
                  </p>
                )}
                {viewingOrder.paymentBank && (
                  <p className="text-gray-700">
                    <span className="font-bold text-gray-500 uppercase text-xs">Banco emisor:</span>{' '}
                    {viewingOrder.paymentBank}
                  </p>
                )}
              </div>
            )}

            {/* Acciones */}
            {viewingOrder.status !== 'VOIDED' && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {!isAuxiliar && userRole !== 'supervisor' && (viewingOrder.status === 'PENDING' || (isAdmin && viewingOrder.status === 'PAID')) && (
                  <button onClick={() => openOrderModal(viewingOrder)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wide">
                    <Pencil className="w-3.5 h-3.5" />
                    {isAdmin && viewingOrder.status === 'PAID' ? 'Editar (Admin)' : 'Editar'}
                  </button>
                )}
                {!isAuxiliar && (
                  <button onClick={() => cloneOrder(viewingOrder)}
                    title="Crear copia de esta orden con la misma información"
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wide">
                    <Copy className="w-3.5 h-3.5" />
                    Clonar
                  </button>
                )}
                {viewingOrder.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => updateStatusMut.mutate({ id: viewingOrder.id, status: 'IN_PROCESS' })}
                      disabled={updateStatusMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 text-blue-700 bg-blue-50 text-sm font-bold uppercase tracking-wide hover:bg-blue-100 transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                      En proceso
                    </button>
                    <button onClick={() => openPayModal(viewingOrder)}
                      className="flex items-center gap-1.5 bg-[#F5C218] text-[#1C1C1C] px-3 py-2 text-sm font-bold uppercase tracking-wide hover:bg-yellow-300 transition-colors"
                      disabled={markPaidMut.isPending}>
                      {markPaidMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                      Marcar como pagada
                    </button>
                    <button onClick={() => { if (confirm('¿Anular esta orden de pago?')) voidOrderMut.mutate(viewingOrder.id); }}
                      className="text-sm text-red-600 hover:text-red-700 border border-red-300 hover:bg-red-50 px-3 py-2 font-bold uppercase tracking-wide transition-colors">
                      Anular
                    </button>
                  </>
                )}
                {viewingOrder.status === 'IN_PROCESS' && (
                  <>
                    <button
                      onClick={() => updateStatusMut.mutate({ id: viewingOrder.id, status: 'REJECTED_BANK' })}
                      disabled={updateStatusMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 border border-orange-300 text-orange-700 bg-orange-50 text-sm font-bold uppercase tracking-wide hover:bg-orange-100 transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rechazada banco
                    </button>
                    <button onClick={() => openPayModal(viewingOrder)}
                      className="flex items-center gap-1.5 bg-[#F5C218] text-[#1C1C1C] px-3 py-2 text-sm font-bold uppercase tracking-wide hover:bg-yellow-300 transition-colors"
                      disabled={markPaidMut.isPending}>
                      {markPaidMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                      Marcar como pagada
                    </button>
                  </>
                )}
                {viewingOrder.status === 'REJECTED_BANK' && (
                  <button
                    onClick={() => updateStatusMut.mutate({ id: viewingOrder.id, status: 'PENDING' })}
                    disabled={updateStatusMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 text-amber-700 bg-amber-50 text-sm font-bold uppercase tracking-wide hover:bg-amber-100 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Volver a pendiente
                  </button>
                )}
              </div>
            )}

            {/* Generar gasto retroactivo */}
            {viewingOrder.status === 'PAID' && !viewingOrder.expenseId && viewingOrder.orderType !== 'PAYROLL' && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Esta orden no tiene gasto registrado en el proyecto.
                </p>
                <button
                  onClick={() => generateExpenseMut.mutate(viewingOrder.id)}
                  disabled={generateExpenseMut.isPending}
                  className="text-sm text-[#1C1C1C] border border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#F5C218] px-3 py-2 font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors">
                  {generateExpenseMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Generar gasto
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lista de órdenes */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          {loadingOrders ? (
            <ProjectListSkeleton />
          ) : orders.length === 0 ? (
            <div className="bg-[#1C1C1C] text-center py-12">
              <FileText className="w-10 h-10 mx-auto mb-2 text-[#F5C218]" />
              <p className="text-white font-['Barlow_Condensed'] font-black text-xl uppercase tracking-wide">
                Sin órdenes{filterStatus || filterType ? ' con ese filtro' : ''}.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#1C1C1C]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide font-['Space_Mono']">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Beneficiario</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Proyecto</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide font-['Space_Mono']">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${viewingOrder?.id === o.id ? 'bg-yellow-50 border-l-4 border-[#F5C218]' : ''}`}
                    onClick={() => setViewingOrder(viewingOrder?.id === o.id ? null : o)}>
                    <td className="px-4 py-3 text-xs text-gray-400 font-['Space_Mono'] font-bold">OP-{String(o.number).padStart(3, '0')}</td>
                    <td className="px-4 py-3"><TypeBadge type={o.orderType} /></td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#1C1C1C]">{o.supplier.name}</p>
                      <p className="text-xs text-gray-400">{o.supplier.bank ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-gray-500 font-['Space_Mono']">{o.project.code}</p>
                      <p className="text-xs text-gray-700 font-medium leading-tight">{o.project.name}</p>
                    </td>
                    <td className="px-4 py-3 font-black text-[#1C1C1C] font-['Space_Mono']">{fmtMonto(o.amount, o.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={(e) => { e.stopPropagation(); copyText(o.generatedText ?? ''); }}
                          className="p-1.5 text-gray-400 hover:text-[#1C1C1C] hover:bg-[#F5C218] rounded transition-colors" title="Copiar mensaje">
                          <ClipboardCopy className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); shareWhatsApp(o.generatedText ?? '', () => flash('📋 Copiado — pega en WhatsApp Web')); }}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Compartir por WhatsApp">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── MODAL: ORDEN DE PAGO ────────────────────────── */}
      {orderModal && (
        <Modal title={editingOrder ? 'Editar orden' : 'Nueva orden de pago'} onClose={closeOrderModal} wide>

          {/* VISTA: ÉXITO */}
          {modalView === 'success' && lastCreatedOrder && (
            <div className="space-y-5">
              <div className="bg-green-50 border-l-4 border-green-500 p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-green-800 font-['Barlow_Condensed'] text-lg uppercase">¡Orden generada exitosamente!</p>
                  <p className="text-sm text-green-700 font-['Space_Mono']">
                    OP-{String(lastCreatedOrder.number).padStart(3, '0')}
                    &nbsp;·&nbsp; {lastCreatedOrder.supplier.name}
                    &nbsp;·&nbsp; {fmtMonto(lastCreatedOrder.amount, lastCreatedOrder.currency)}
                  </p>
                  {sessionOrders.length > 1 && (
                    <p className="text-xs text-green-600 mt-1 font-bold">
                      {sessionOrders.length} órdenes generadas en esta sesión
                    </p>
                  )}
                </div>
              </div>

              {lastCreatedOrder.generatedText && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 font-['Space_Mono']">Mensaje para enviar</p>
                  <div className="bg-[#1C1C1C] text-gray-100 p-4 font-['Space_Mono'] text-xs whitespace-pre-wrap leading-relaxed">
                    {lastCreatedOrder.generatedText}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button onClick={() => copyText(lastCreatedOrder.generatedText!)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wide">
                      <ClipboardCopy className="w-4 h-4" /> Copiar
                    </button>
                    <button onClick={() => shareWhatsApp(lastCreatedOrder.generatedText!, () => flash('📋 Copiado — pega en WhatsApp Web'))}
                      className="flex items-center gap-2 px-3 py-2 border border-green-300 text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 uppercase tracking-wide">
                      <MessageCircle className="w-4 h-4" /> Compartir por WhatsApp
                    </button>
                  </div>
                </div>
              )}

              {sessionOrders.length > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide font-['Space_Mono']">Órdenes de esta sesión ({sessionOrders.length})</p>
                    <div className="flex gap-1">
                      <button onClick={() => copyText(sessionOrders.map((o, i) => `${i + 1}. ${o.generatedText ?? ''}`).join('\n\n-------------\n\n'))}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 uppercase tracking-wide">
                        <ClipboardCopy className="w-3 h-3" /> Copiar todas
                      </button>
                      <button onClick={() => shareWhatsApp(sessionOrders.map((o, i) => `${i + 1}. ${o.generatedText ?? ''}`).join('\n\n-------------\n\n'), () => flash('📋 Copiado'))}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 uppercase tracking-wide">
                        <MessageCircle className="w-3 h-3" /> Compartir todas
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {sessionOrders.map((o, i) => (
                      <div key={o.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 text-sm">
                        <span className="text-xs text-gray-400 font-['Space_Mono'] shrink-0">{i + 1}. OP-{String(o.number).padStart(3, '0')}</span>
                        <span className="text-gray-700 truncate mx-3 flex-1">{o.supplier.name}</span>
                        <span className="text-gray-500 shrink-0 text-xs font-['Space_Mono']">{fmtMonto(o.amount, o.currency)}</span>
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => copyText(o.generatedText ?? '')} title="Copiar"
                            className="p-1 text-gray-400 hover:text-[#1C1C1C] rounded"><ClipboardCopy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => shareWhatsApp(o.generatedText ?? '', () => flash('📋 Copiado'))} title="WhatsApp"
                            className="p-1 text-gray-400 hover:text-green-600 rounded"><MessageCircle className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={crearOtraOrden}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wide">
                  <Plus className="w-4 h-4" /> Crear otra orden
                </button>
                <button onClick={closeOrderModal}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-yellow-300">
                  <CheckCircle className="w-4 h-4" /> Cerrar
                </button>
              </div>
            </div>
          )}

          {/* VISTA: FORMULARIO */}
          {modalView === 'form' && (
            <>
              {formErr && <AlertBox msg={formErr} />}

              <div className="mb-5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tipo de orden *</label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(ORDER_TYPE_CFG) as OrderType[]).map((t) => {
                    const cfg = ORDER_TYPE_CFG[t];
                    const active = orderForm.orderType === t;
                    return (
                      <button key={t} type="button"
                        onClick={() => setOrderForm((f) => ({
                          ...f, orderType: t, payrollId: '', quotationId: '',
                          ...(!editingOrder ? { amount: '', concept: '' } : {}),
                        }))}
                        className={`p-3 border-2 text-left transition-all ${active ? `bg-[#1C1C1C] ${cfg.dark}` : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                        <div className={`mb-1 ${active ? 'text-[#F5C218]' : 'text-gray-400'}`}>{cfg.icon}</div>
                        <p className={`text-xs font-bold uppercase tracking-wide ${active ? 'text-white' : 'text-gray-600'}`}>{cfg.label}</p>
                        <p className={`text-xs mt-0.5 leading-tight ${active ? 'text-gray-400' : 'text-gray-400'}`}>{cfg.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Empresa pagadora *">
                  <input className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]"
                    placeholder="SERVINGMI SRL" value={orderForm.payingCompany}
                    onChange={(e) => setOrderForm((f) => ({ ...f, payingCompany: e.target.value }))} />
                </Field>
                <Field label="Proyecto *">
                  <select className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]" value={orderForm.projectId}
                    onChange={(e) => setOrderForm((f) => ({ ...f, projectId: e.target.value, payrollId: '', contratoAjustadoId: '', batchItemId: '' }))}>
                    <option value="">— Selecciona —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </Field>
              </div>

              <BatchItemSelect
                projectId={
                  projects.find((p) => p.id === orderForm.projectId)?.batchesEnabled
                    ? orderForm.projectId || undefined
                    : undefined
                }
                value={orderForm.batchItemId}
                onChange={(v) => setOrderForm((f) => ({ ...f, batchItemId: v }))}
                className="mb-3"
              />

              {orderForm.orderType === 'PAYROLL' && !editingOrder && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 space-y-3 mb-1">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide font-['Space_Mono']">
                    Datos de la nómina — se creará automáticamente
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Período inicio *</label>
                      <input type="date" className="w-full border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        value={orderForm.payrollPeriodStart} onChange={(e) => setOrderForm((f) => ({ ...f, payrollPeriodStart: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Período fin *</label>
                      <input type="date" className="w-full border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        value={orderForm.payrollPeriodEnd} onChange={(e) => setOrderForm((f) => ({ ...f, payrollPeriodEnd: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">✅ Al generar la orden, la nómina se crea y aprueba automáticamente.</p>
                </div>
              )}

              {orderForm.orderType === 'PAYROLL' && editingOrder && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 text-xs text-blue-700 mb-2">
                  <strong>Orden de Nómina:</strong> Los datos del período no se pueden modificar desde aquí.
                </div>
              )}

              {orderForm.orderType === 'MATERIALS' && (
                <div className="bg-amber-50 border-l-4 border-[#F5C218] p-3 text-xs text-amber-700 mb-2">
                  <strong>Orden de Materiales:</strong> El gasto se vincula desde el detalle una vez que la transferencia sea confirmada.
                </div>
              )}

              <Field label="Suplidor / Beneficiario *">
                <div className="flex gap-2 items-end">
                  <select className="flex-1 border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]" value={orderForm.supplierId}
                    onChange={(e) => { setOrderForm((f) => ({ ...f, supplierId: e.target.value, bankAccountId: '', contratoAjustadoId: '', creditLineId: null })); setSupplierSearch(''); setLinkToCreditLine(false); setCreditLineSupplierId(''); }}>
                    <option value="">— Selecciona suplidor —</option>
                    {activeSuppliers
                      .filter((s) => (s.bankAccounts && s.bankAccounts.length > 0) || (s.bank && s.accountNumber))
                      .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setQuickCreateOpen(true)}
                    className="shrink-0 px-3 py-2 bg-[#F5C218] text-[#1C1C1C] font-['Barlow_Condensed'] font-bold text-sm uppercase tracking-wide hover:bg-yellow-400 transition-colors"
                  >
                    + Nuevo
                  </button>
                </div>
                {activeSuppliers.filter((s) => (!s.bankAccounts || s.bankAccounts.length === 0) && (!s.bank || !s.accountNumber)).length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Solo se muestran suplidores con datos bancarios.</p>
                )}
              </Field>

              {orderForm.supplierId && (() => {
                const s = activeSuppliers.find((x) => x.id === orderForm.supplierId);
                if (!s) return null;
                const accounts = s.bankAccounts ?? [];
                if (accounts.length > 1) {
                  const selected = accounts.find((a) => a.id === orderForm.bankAccountId) ?? accounts.find((a) => a.isDefault) ?? accounts[0];
                  return (
                    <div className="-mt-2 mb-4">
                      <select className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]"
                        value={orderForm.bankAccountId || selected?.id || ''}
                        onChange={(e) => setOrderForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>🏦 {a.bank} · {a.accountType} · {a.accountNumber}{a.isDefault ? ' ★' : ''}</option>)}
                      </select>
                    </div>
                  );
                }
                const acc = accounts[0];
                const bank    = acc?.bank          ?? s.bank;
                const accType = acc?.accountType   ?? s.accountType;
                const accNum  = acc?.accountNumber ?? s.accountNumber;
                if (!bank && !accNum) return (
                  <div className="bg-orange-50 border-l-4 border-orange-400 p-3 text-xs text-orange-700 -mt-2 mb-4">
                    ⚠️ Este suplidor no tiene cuentas bancarias registradas.
                  </div>
                );
                return (
                  <div className="bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600 -mt-2 mb-4 font-['Space_Mono'] text-xs">
                    🏦 <strong>{bank}</strong> &nbsp;·&nbsp; {accType} &nbsp;·&nbsp; {accNum}
                    {s.cedula && <> &nbsp;·&nbsp; {s.cedula}</>}
                    {s.rnc    && <> &nbsp;·&nbsp; RNC: {s.rnc}</>}
                  </div>
                );
              })()}

              {availableContracts.length > 0 && (() => {
                const selectedContrato = availableContracts.find((c: any) => c.id === orderForm.contratoAjustadoId);
                return (
                  <div className="bg-indigo-50 border-l-4 border-indigo-400 p-3 mb-1">
                    <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wide mb-1.5">
                      Vincular a contrato ajustado <span className="font-normal normal-case">(opcional)</span>
                    </label>
                    <select className="w-full border border-indigo-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                      value={orderForm.contratoAjustadoId}
                      onChange={(e) => setOrderForm((f) => ({ ...f, contratoAjustadoId: e.target.value }))}>
                      <option value="">— Sin contrato ajustado —</option>
                      {availableContracts.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.descripcionTrabajo} · RD$ {Number(c.montoContratado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                    {selectedContrato && (
                      <div className="mt-2 space-y-1.5">
                        {selectedContrato.adendas > 0 && (
                          <div className="flex justify-between items-center text-[11px] font-['Space_Mono'] bg-indigo-100 px-2 py-1">
                            <span className="text-indigo-500">Base RD$ {Number(selectedContrato.montoBase ?? selectedContrato.montoContratado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            <span className="text-indigo-700 font-bold">+ Adendas RD$ {Number(selectedContrato.adendas).toLocaleString('es-DO', { minimumFractionDigits: 2 })} → Total efectivo RD$ {Number(selectedContrato.montoContratado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-xs font-['Space_Mono']">
                          <div className="bg-white border border-indigo-200 px-2 py-1.5 text-center">
                            <div className="text-indigo-400 font-['Barlow_Condensed'] uppercase tracking-wider text-[10px] mb-0.5">Total contrato</div>
                            <div className="font-bold text-indigo-800">RD$ {Number(selectedContrato.montoContratado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div className="bg-white border border-indigo-200 px-2 py-1.5 text-center">
                            <div className="text-indigo-400 font-['Barlow_Condensed'] uppercase tracking-wider text-[10px] mb-0.5">Total pagado</div>
                            <div className="font-bold text-green-700">RD$ {(selectedContrato.totalPagado ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div className={`bg-white border px-2 py-1.5 text-center ${(selectedContrato.pendiente ?? selectedContrato.montoContratado) <= 0 ? 'border-green-300' : 'border-[#F5C218]'}`}>
                            <div className="text-indigo-400 font-['Barlow_Condensed'] uppercase tracking-wider text-[10px] mb-0.5">Resta pagar</div>
                            <div className={`font-bold ${(selectedContrato.pendiente ?? selectedContrato.montoContratado) <= 0 ? 'text-green-600' : 'text-[#1C1C1C]'}`}>
                              RD$ {(selectedContrato.pendiente ?? selectedContrato.montoContratado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {orderForm.contratoAjustadoId && !selectedContrato && (
                      <p className="text-xs text-indigo-600 mt-1">✅ El gasto generado quedará vinculado automáticamente a este contrato.</p>
                    )}
                  </div>
                );
              })()}

              {orderForm.orderType === 'SERVICIO' && availableQuotations.length > 0 && (() => {
                const selectedQuotation = availableQuotations.find((q: any) => q.id === orderForm.quotationId);
                return (
                  <div className="bg-teal-50 border-l-4 border-teal-400 p-3 mb-1">
                    <label className="block text-xs font-bold text-teal-700 uppercase tracking-wide mb-1.5">
                      Vincular a cotización abierta <span className="font-normal normal-case">(opcional)</span>
                    </label>
                    <select className="w-full border border-teal-200 px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                      value={orderForm.quotationId}
                      onChange={(e) => setOrderForm((f) => ({ ...f, quotationId: e.target.value }))}>
                      <option value="">— Sin cotización vinculada —</option>
                      {availableQuotations.map((q: any) => (
                        <option key={q.id} value={q.id}>
                          COTI-{String(q.number).padStart(3, '0')} · {q.supplierName?.slice(0, 30)} · {q.description?.slice(0, 40)}{q.description?.length > 40 ? '…' : ''} · {q.currency} {Number(q.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                    {selectedQuotation && (
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-['Space_Mono']">
                        <div className="bg-white border border-teal-200 px-2 py-1.5 text-center">
                          <div className="text-teal-400 font-['Barlow_Condensed'] uppercase tracking-wider text-[10px] mb-0.5">Total cotización</div>
                          <div className="font-bold text-teal-800">RD$ {Number(selectedQuotation.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="bg-white border border-teal-200 px-2 py-1.5 text-center">
                          <div className="text-teal-400 font-['Barlow_Condensed'] uppercase tracking-wider text-[10px] mb-0.5">Total pagado</div>
                          <div className="font-bold text-green-700">RD$ {(selectedQuotation.totalPagado ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className={`bg-white border px-2 py-1.5 text-center ${(selectedQuotation.pendiente ?? selectedQuotation.total) <= 0 ? 'border-green-300' : 'border-[#F5C218]'}`}>
                          <div className="text-teal-400 font-['Barlow_Condensed'] uppercase tracking-wider text-[10px] mb-0.5">Resta pagar</div>
                          <div className={`font-bold ${(selectedQuotation.pendiente ?? selectedQuotation.total) <= 0 ? 'text-green-600' : 'text-[#1C1C1C]'}`}>
                            RD$ {(selectedQuotation.pendiente ?? selectedQuotation.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    )}
                    {orderForm.quotationId && !selectedQuotation && (
                      <p className="text-xs text-teal-600 mt-1">✅ Al confirmar el pago, el gasto quedará vinculado automáticamente a esta cotización.</p>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Monto *">
                  <input type="text" inputMode="decimal"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#1C1C1C]"
                    placeholder="0.00" value={fmtAmountInput(orderForm.amount)}
                    onChange={(e) => {
                      const raw = parseAmountInput(e.target.value);
                      if (/^[0-9]*\.?[0-9]{0,2}$/.test(raw) || raw === '') {
                        setOrderForm((f) => ({ ...f, amount: raw }));
                      }
                    }}
                  />
                </Field>
                <Field label="Moneda *">
                  <select className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]" value={orderForm.currency}
                    onChange={(e) => setOrderForm((f) => ({ ...f, currency: e.target.value }))}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Concepto / Descripción *</label>
                  <button type="button" onClick={handleSuggestConcept} disabled={conceptLoading}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors font-bold disabled:opacity-50 uppercase tracking-wide">
                    {conceptLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> Generando...</> : <><Sparkles className="w-3 h-3" /> IA</>}
                  </button>
                </div>
                <textarea className="w-full border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#1C1C1C]"
                  rows={2} placeholder="Pago de servicios..."
                  value={orderForm.concept} onChange={(e) => setOrderForm((f) => ({ ...f, concept: e.target.value }))} />
              </div>

              <Field label="Notas (opcional)">
                <input className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]"
                  placeholder="Información adicional" value={orderForm.notes}
                  onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} />
              </Field>

              {!editingOrder && supplierHasCreditLines && (
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={linkToCreditLine}
                      onChange={(e) => {
                        setLinkToCreditLine(e.target.checked);
                        if (e.target.checked) {
                          setCreditLineSupplierId(orderForm.supplierId);
                        } else {
                          setCreditLineSupplierId('');
                          setOrderForm((f) => ({ ...f, creditLineId: null }));
                        }
                      }}
                      className="accent-[#F5C218]"
                    />
                    <span className="text-sm font-['DM_Sans'] text-gray-700">Vincular a línea de crédito de suplidor</span>
                  </label>

                  {linkToCreditLine && (
                    <div className="space-y-3">
                      {selectedSupplierCreditLines && (
                        <div>
                          <label className="block text-xs font-['Barlow_Condensed'] uppercase tracking-[0.1em] text-gray-500 mb-1">LÍNEA DE CRÉDITO</label>
                          <select
                            value={orderForm.creditLineId ?? ''}
                            onChange={(e) => setOrderForm((f) => ({ ...f, creditLineId: e.target.value || null }))}
                            className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] focus:outline-none"
                          >
                            <option value="">Seleccionar línea…</option>
                            {selectedSupplierCreditLines.map((l: any) => (
                              <option key={l.id} value={l.id}>
                                {l.notes || 'Línea'} — Disponible: RD$ {l.balance?.available?.toLocaleString() ?? '...'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <ModalFooter onCancel={closeOrderModal} onSave={saveOrder}
                saving={createOrderMut.isPending || updateOrderMut.isPending}
                label={editingOrder ? 'Guardar cambios' : 'Generar orden'} />
            </>
          )}
        </Modal>
      )}

      {/* ── MODAL: VINCULAR GASTO ─────────────────────── */}
      {linkModal && viewingOrder && (
        <Modal title="Vincular gasto de materiales" onClose={() => setLinkModal(false)}>
          <p className="text-sm text-gray-500 mb-4">
            Selecciona el gasto por transferencia en el proyecto <strong>{viewingOrder.project.code}</strong> que corresponde a esta orden.
          </p>
          {availableExpenses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No hay gastos por transferencia disponibles en este proyecto.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableExpenses.map((e: any) => (
                <label key={e.id}
                  className={`flex items-start gap-3 p-3 border-2 cursor-pointer transition-all ${
                    selectedExpenseId === e.id ? 'border-[#1C1C1C] bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                  }`}>
                  <input type="radio" name="expense" value={e.id} className="mt-1 accent-[#1C1C1C]"
                    checked={selectedExpenseId === e.id} onChange={() => setSelectedExpenseId(e.id)} />
                  <div>
                    <p className="font-bold text-[#1C1C1C] text-sm">{e.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-['Space_Mono']">
                      {fmtMonto(e.amount, 'RD$')} &nbsp;·&nbsp; {fmtDate(e.expenseDate)}
                      &nbsp;·&nbsp; {e.category?.name}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <ModalFooter
            onCancel={() => setLinkModal(false)}
            onSave={() => { if (!selectedExpenseId) return; linkExpenseMut.mutate({ id: viewingOrder.id, expenseId: selectedExpenseId }); }}
            saving={linkExpenseMut.isPending}
            label="Vincular gasto"
          />
        </Modal>
      )}

      {/* ── MODAL: VINCULAR NÓMINA ─────────────────────── */}
      {linkPayrollModal && viewingOrder && (
        <Modal title="Vincular nómina a esta orden" onClose={() => { setLinkPayrollModal(false); setSelectedPayrollId(''); }}>
          {projectPayrolls.filter((p: any) => p.status === 'APPROVED').length === 0 ? (
            <div className="text-center py-4 text-gray-400">
              <p className="text-sm">No hay nóminas aprobadas para este proyecto.</p>
              <p className="text-xs mt-1">Solo se pueden vincular nóminas con estado <strong>Aprobada</strong>.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {projectPayrolls.filter((p: any) => p.status === 'APPROVED').map((p: any) => (
                <label key={p.id}
                  className={`flex items-start gap-3 p-3 border-2 cursor-pointer transition-all ${
                    selectedPayrollId === p.id ? 'border-[#1C1C1C] bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                  }`}>
                  <input type="radio" name="payroll-select" checked={selectedPayrollId === p.id}
                    onChange={() => setSelectedPayrollId(p.id)} className="mt-0.5 accent-[#1C1C1C]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1C1C1C] text-sm">
                      NOM-{String(p.number).padStart(3, '0')} — {p.description || p.type}
                      <span className={`ml-2 px-2 py-0.5 text-xs font-bold uppercase ${p.status === 'PAID' ? 'bg-green-100 text-green-700' : p.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'PAID' ? 'Pagada' : p.status === 'APPROVED' ? 'Aprobada' : 'Borrador'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 font-['Space_Mono']">
                      {fmtDate(p.periodStart)} — {fmtDate(p.periodEnd)}
                      &nbsp;·&nbsp; RD$ {Number(p.totalAmount).toLocaleString('es-DO')}
                      &nbsp;·&nbsp; {p.lines?.length ?? 0} líneas
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <ModalFooter
            onCancel={() => { setLinkPayrollModal(false); setSelectedPayrollId(''); }}
            onSave={() => { if (!selectedPayrollId) return; linkPayrollMut.mutate({ id: viewingOrder.id, payrollId: selectedPayrollId }); }}
            saving={linkPayrollMut.isPending}
            label="Vincular nómina"
          />
        </Modal>
      )}

      {/* ── Modal: Crear suplidor rápido ─────────────── */}
      <QuickCreateSupplierModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={(supplier) => {
          qc.invalidateQueries({ queryKey: ['suppliers', 'active-with-bank'] });
          setOrderForm((f) => ({ ...f, supplierId: supplier.id }));
        }}
      />

      {/* ── Modal: Confirmar pago ─────────────────────── */}
      {payModal && payingOrder && (
        <Modal title="Confirmar pago" onClose={closePayModal} size="md">
          <div className="space-y-4">
            <div className="bg-[#1C1C1C] p-3 text-sm space-y-1">
              <p className="font-black text-white font-['Barlow_Condensed'] text-lg uppercase tracking-wide">
                OP-{String(payingOrder.number).padStart(3, '0')} — {payingOrder.concept}
              </p>
              <p className="text-gray-400 font-['Space_Mono'] text-xs">
                {payingOrder.supplier?.name} · {fmtMonto(payingOrder.amount, payingOrder.currency)}
              </p>
            </div>

            <input
              ref={ocrPayInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleOcrPayScan(file); e.target.value = ''; }}
            />
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comprobante fiscal (opcional)</p>
              <button type="button" onClick={() => ocrPayInputRef.current?.click()} disabled={ocrPayLoading}
                className="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-800 border border-violet-300 hover:bg-violet-50 px-2.5 py-1 transition-all disabled:opacity-50 uppercase tracking-wide">
                {ocrPayLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> Analizando...</> : <><Camera className="w-3 h-3" /> Escanear factura</>}
              </button>
            </div>
            <FiscalVoucherForm
              value={fiscalForm}
              onChange={setFiscalForm}
              defaultRnc={payingOrder.supplier?.rnc ?? ''}
              defaultName={payingOrder.supplier?.name ?? ''}
            />
            {ocrPayError && (
              <p className="text-xs text-red-600 bg-red-50 border-l-4 border-red-500 px-3 py-2 mt-1">{ocrPayError}</p>
            )}

            <div className="space-y-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide font-['Space_Mono']">Transferencia (opcional)</p>
              {payingOrder.currency !== 'RD$' && (
                <div className="bg-amber-50 border-l-4 border-[#F5C218] p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                    Orden en {payingOrder.currency} — Tasa de cambio requerida
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-bold text-gray-600 shrink-0">
                      1 {payingOrder.currency} = RD$
                    </label>
                    <input
                      type="number"
                      value={payInfoForm.exchangeRate}
                      onChange={(e) => setPayInfoForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                      placeholder="ej. 60.50" min="0.01" step="0.01"
                      className="flex-1 border border-amber-300 px-3 py-2 text-sm font-['Space_Mono'] focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  {payInfoForm.exchangeRate && Number(payInfoForm.exchangeRate) > 0 && (
                    <p className="text-xs text-amber-700 font-['Space_Mono']">
                      Equivalente: RD$ {(Number(payingOrder.amount) * Number(payInfoForm.exchangeRate)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              )}

              <TransferPaymentForm
                value={{ paymentMethod: 'TRANSFER', paymentBank: payInfoForm.paymentBank, paymentReference: payInfoForm.paymentReference }}
                onChange={(next) => setPayInfoForm((f) => ({ ...f, paymentBank: next.paymentBank, paymentReference: next.paymentReference }))}
                bankLabel="Banco emisor"
              />
            </div>

            {fiscalErr && <p className="text-sm text-red-600 bg-red-50 border-l-4 border-red-500 px-3 py-2">{fiscalErr}</p>}

            {fiscalForm.hasFiscal && (
              <div className={`border-l-4 p-3 ${ocrPayValidated ? 'border-green-400 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={ocrPayValidated} onChange={(e) => setOcrPayValidated(e.target.checked)} className="mt-1" />
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${ocrPayValidated ? 'text-green-800' : 'text-amber-900'}`}>
                      {ocrPayValidated ? '✓ Datos del OCR validados' : 'Confirmar datos extraídos por IA'}
                    </p>
                    <p className={`text-xs mt-1 ${ocrPayValidated ? 'text-green-700' : 'text-amber-700'}`}>
                      {ocrPayValidated
                        ? 'Has confirmado que los datos coinciden con la factura original.'
                        : 'Compara los campos completados automáticamente con la factura original antes de confirmar.'}
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          <ModalFooter
            onCancel={closePayModal}
            onSave={() => {
              if (fiscalForm.hasFiscal && !ocrPayValidated) {
                setFiscalErr('Debes confirmar los datos del OCR antes de continuar');
                return;
              }
              setFiscalErr('');
              const isForeignOrder = payingOrder.currency !== 'RD$';
              if (isForeignOrder && !payInfoForm.exchangeRate) {
                setFiscalErr(`Debe ingresar la tasa de cambio para órdenes en ${payingOrder.currency}`); return;
              }
              const pi = {
                paymentReference: payInfoForm.paymentReference.trim() || undefined,
                paymentBank:      payInfoForm.paymentBank.trim()      || undefined,
                exchangeRate:     payInfoForm.exchangeRate ? Number(payInfoForm.exchangeRate) : undefined,
              };
              if (fiscalForm.hasFiscal) {
                if (!fiscalForm.ncf)          { setFiscalErr('El NCF es obligatorio cuando hay comprobante fiscal'); return; }
                if (!fiscalForm.supplierRnc)  { setFiscalErr('El RNC del suplidor es obligatorio'); return; }
                if (!fiscalForm.supplierName) { setFiscalErr('El nombre del suplidor es obligatorio'); return; }
                const ncf = fiscalForm.ncf.trim();
                if (!validateNcf(ncf)) { setFiscalErr('Formato de NCF inválido. Ej: B0100000001 (NCF) o E310000000001 (e-NCF)'); return; }
                markPaidMut.mutate({
                  id: payingOrder.id,
                  fiscalVoucher: { ncf, supplierRnc: fiscalForm.supplierRnc.trim(), supplierName: fiscalForm.supplierName.trim(), itbisAmount: fiscalForm.itbisAmount ? Number(fiscalForm.itbisAmount) : 0 },
                  paymentInfo: pi,
                });
              } else {
                markPaidMut.mutate({ id: payingOrder.id, fiscalVoucher: null, paymentInfo: pi });
              }
            }}
            saving={markPaidMut.isPending}
            label="Confirmar pago"
          />
        </Modal>
      )}
    </div>
  );
}
