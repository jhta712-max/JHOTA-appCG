import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, CheckCircle, AlertCircle, Loader2,
  Pencil, ClipboardCopy, X,
  BadgeCheck, Clock, Wallet, Link, Unlink, ShoppingCart,
  MessageCircle, Sparkles,
} from 'lucide-react';
import { paymentOrdersApi, projectsApi, payrollApi, suppliersApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import type { PaymentOrder, Supplier, SupplierBankAccount } from '../../types';

// ── Tipos locales ─────────────────────────────────────────────
type OrderType = 'SERVICIO' | 'PAYROLL' | 'MATERIALS';
type ModalView = 'form' | 'success';

type OrderForm = {
  orderType: OrderType; payingCompany: string; supplierId: string;
  projectId: string; amount: string; currency: string; concept: string;
  notes: string; payrollId: string; bankAccountId: string; contratoAjustadoId: string; quotationId: string;
  payrollPeriodStart: string; payrollPeriodEnd: string; payrollType: 'LABOR' | 'SERVICE';
};
const EMPTY_ORDER: OrderForm = {
  orderType: 'SERVICIO', payingCompany: '', supplierId: '', projectId: '',
  amount: '', currency: 'RD$', concept: '', notes: '', payrollId: '', bankAccountId: '', contratoAjustadoId: '', quotationId: '',
  payrollPeriodStart: '', payrollPeriodEnd: '', payrollType: 'LABOR',
};

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'];
const CURRENCIES    = ['RD$', 'US$', '€'];

const NCF_REGEX    = /^[A-Z]\d{10}$/;
const E_NCF_REGEX  = /^E\d{12}$/;
const validateNcf  = (v: string) => NCF_REGEX.test(v) || E_NCF_REGEX.test(v);

const ORDER_TYPE_CFG: Record<OrderType, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  SERVICIO:  { label: 'Servicio',   icon: <FileText className="w-4 h-4" />,      color: 'border-purple-300 bg-purple-50',  desc: 'Pago por servicios' },
  PAYROLL:   { label: 'Nómina',     icon: <Wallet className="w-4 h-4" />,        color: 'border-blue-400 bg-blue-50',     desc: 'Pago de mano de obra' },
  MATERIALS: { label: 'Materiales', icon: <ShoppingCart className="w-4 h-4" />,  color: 'border-amber-400 bg-amber-50',   desc: 'Compra de insumos por transferencia' },
};

const STATUS_CFG = {
  PENDING: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700',  icon: <Clock className="w-3 h-3" /> },
  PAID:    { label: 'Pagada',    cls: 'bg-green-100 text-green-700',  icon: <BadgeCheck className="w-3 h-3" /> },
  VOIDED:  { label: 'Anulada',   cls: 'bg-gray-100 text-gray-500',   icon: <X className="w-3 h-3" /> },
} as const;

const ACCT_BADGE: Record<string, string> = {
  'Cuenta de Ahorros': 'bg-blue-100 text-blue-700',
  'Cuenta Corriente':  'bg-amber-100 text-amber-700',
  'Cuenta Nómina':     'bg-green-100 text-green-700',
};

const PAYROLL_TYPE_LABEL: Record<string, string> = { LABOR: 'Mano de obra', SERVICE: 'Servicios' };

function fmtMonto(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Formatea un string numérico como moneda mientras se escribe: "300000" → "300,000"
function fmtAmountInput(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, '');
  const parts  = clean.split('.');
  const int    = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${int}.${parts[1].slice(0, 2)}` : int;
}
// Extrae el valor numérico de un string formateado: "300,000.00" → "300000.00"
function parseAmountInput(formatted: string): string {
  return formatted.replace(/,/g, '');
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── CSV helpers ───────────────────────────────────────────────

/** Normaliza cualquier variante del tipo de cuenta al enum que acepta el backend */
function normalizeAccountType(raw: string): 'Cuenta de Ahorros' | 'Cuenta Corriente' | 'Cuenta Nómina' {
  // Quitar tildes manualmente (sin regex Unicode que puede fallar)
  const v = raw.toLowerCase().trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
  if (v.includes('corriente'))           return 'Cuenta Corriente';
  if (v.includes('nomina'))              return 'Cuenta Nómina';
  return 'Cuenta de Ahorros'; // cubre: ahorro, ahorros, cuenta de ahorros, etc.
}


// ── WhatsApp share ────────────────────────────────────────────
const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function shareWhatsApp(text: string, onCopied?: () => void) {
  const encoded = encodeURIComponent(text);
  if (isMobileDevice()) {
    window.open(`whatsapp://send?text=${encoded}`, '_blank');
  } else {
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    onCopied?.();
  }
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
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [filterType,   setFilterType]   = useState('');

  // Modales
  const [orderModal,       setOrderModal]       = useState(false);
  const [linkModal,        setLinkModal]         = useState(false);
  const [linkPayrollModal, setLinkPayrollModal]  = useState(false);

  // Estado del modal de orden (batch mode)
  const [modalView,        setModalView]        = useState<ModalView>('form');
  const [lastCreatedOrder, setLastCreatedOrder] = useState<PaymentOrder | null>(null);
  const [sessionOrders,    setSessionOrders]    = useState<PaymentOrder[]>([]);

  const [editingOrder, setEditingOrder] = useState<PaymentOrder | null>(null);
  const [orderForm,    setOrderForm]    = useState<OrderForm>(EMPTY_ORDER);
  const [formErr,      setFormErr]      = useState('');
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [selectedPayrollId, setSelectedPayrollId] = useState('');
  const [supplierSearch,    setSupplierSearch]    = useState('');

  // Modal confirmar pago + comprobante fiscal
  const [payModal,     setPayModal]     = useState(false);
  const [payingOrder,  setPayingOrder]  = useState<PaymentOrder | null>(null);
  const [fiscalForm,   setFiscalForm]   = useState({ hasFiscal: false, ncf: '', supplierRnc: '', supplierName: '', itbisAmount: '' });
  const [payInfoForm,  setPayInfoForm]  = useState({ paymentBank: '', paymentReference: '', exchangeRate: '' });
  const [fiscalErr,    setFiscalErr]    = useState('');
  const [conceptLoading, setConceptLoading] = useState(false);

  const openPayModal = (o: PaymentOrder) => {
    setPayingOrder(o);
    setFiscalForm({ hasFiscal: false, ncf: '', supplierRnc: o.supplier?.rnc ?? '', supplierName: o.supplier?.name ?? '', itbisAmount: '' });
    setPayInfoForm({ paymentBank: '', paymentReference: '', exchangeRate: '' });
    setFiscalErr('');
    setPayModal(true);
  };
  const closePayModal = () => { setPayModal(false); setPayingOrder(null); };

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleSuggestConcept = async () => {
    setConceptLoading(true);
    try {
      const supplier = activeSuppliers.find((s) => s.id === orderForm.supplierId);
      const project  = projects.find((p) => p.id === orderForm.projectId);
      const res = await paymentOrdersApi.suggestConcept({
        orderType:    orderForm.orderType,
        supplierName: supplier?.name,
        projectCode:  project?.code,
        projectName:  project?.name,
        amount:       orderForm.amount ? parseFloat(orderForm.amount.replace(/,/g, '')) : undefined,
        currency:     orderForm.currency,
      });
      setOrderForm((f) => ({ ...f, concept: res.data.data.concept }));
    } catch { /* silencioso */ } finally {
      setConceptLoading(false);
    }
  };

  // ── Queries ───────────────────────────────────────────────────
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['payment-orders', filterStatus, filterType],
    queryFn:  () => paymentOrdersApi.list({
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterType   ? { orderType: filterType } : {}),
    }),
    select: (r) => (r.data as any).data as PaymentOrder[],
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'active'],
    queryFn:  () => projectsApi.list({ status: 'ACTIVE', limit: 100 }),
    select:   (r) => r.data.data,
  });

  const { data: activeSuppliers = [] } = useQuery({
    queryKey: ['suppliers', 'active-with-bank'],
    queryFn:  () => suppliersApi.list({ onlyActive: true }),
    select:   (r) => r.data.data as Supplier[],
    enabled:  orderModal,
  });

  const linkingOrderProjectId = viewingOrder?.projectId ?? '';

  // Nóminas del proyecto para vincular retroactivamente
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
  });

  const { data: availableQuotations = [] } = useQuery({
    queryKey: ['payment-orders', 'quotations', orderForm.projectId, orderForm.supplierId],
    queryFn:  () => paymentOrdersApi.availableQuotations(orderForm.projectId, orderForm.supplierId),
    select:   (r) => r.data.data as any[],
    enabled:  orderModal && orderForm.orderType === 'SERVICIO' && !!orderForm.projectId && !!orderForm.supplierId,
  });

  // ── Order mutations ───────────────────────────────────────────
  const createOrderMut = useMutation({
    mutationFn: (d: unknown) => paymentOrdersApi.create(d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
      const newOrder = res.data.data as PaymentOrder;
      setLastCreatedOrder(newOrder);
      setSessionOrders((prev) => [...prev, newOrder]);
      setViewingOrder(newOrder);
      setModalView('success');
      flash('✅ Orden generada');
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

  // ── Order modal helpers ───────────────────────────────────────
  const normalizeOrderType = (type: any): OrderType => {
    if (type === 'GENERAL') return 'SERVICIO';
    if (['SERVICIO', 'PAYROLL', 'MATERIALS'].includes(type)) return type;
    return 'SERVICIO';
  };

  const openOrderModal = (o?: PaymentOrder) => {
    setEditingOrder(o ?? null);
    const payroll = (o as any)?.payroll;
    setOrderForm(o
      ? {
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
        }
      : EMPTY_ORDER
    );
    setModalView('form');
    setSessionOrders([]);
    setLastCreatedOrder(null);
    setFormErr('');
    setOrderModal(true);
  };

  const closeOrderModal = () => {
    setOrderModal(false);
    setEditingOrder(null);
    setOrderForm(EMPTY_ORDER);
    setFormErr('');
    setModalView('form');
    setSessionOrders([]);
    setLastCreatedOrder(null);
  };

  // "Crear otra" — mantiene empresa y proyecto, resetea el resto
  const crearOtraOrden = () => {
    setOrderForm((f) => ({ ...EMPTY_ORDER, payingCompany: f.payingCompany, projectId: f.projectId }));
    setFormErr('');
    setModalView('form');
  };

  const saveOrder = () => {
    if (!orderForm.payingCompany.trim()) return setFormErr('La empresa pagadora es requerida');
    if (!orderForm.supplierId)           return setFormErr('Selecciona un suplidor / beneficiario');
    if (!orderForm.projectId)            return setFormErr('Selecciona un proyecto');
    if (!orderForm.amount || Number(orderForm.amount) <= 0) return setFormErr('El monto debe ser mayor a 0');
    if (!orderForm.concept.trim())       return setFormErr('El concepto es requerido');

    // PAYROLL: validar período (solo en creación)
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
    };

    if (isNewPayroll) {
      payload.payrollData = {
        periodStart: orderForm.payrollPeriodStart,
        periodEnd:   orderForm.payrollPeriodEnd,
        type:        'LABOR',
      };
    }

    if (editingOrder) updateOrderMut.mutate({ id: editingOrder.id, d: payload });
    else              createOrderMut.mutate(payload);
  };

  const copyText = (text: string) => { navigator.clipboard.writeText(text).then(() => flash('📋 Texto copiado')); };


  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="module-label">MÓDULO / ÓRDENES DE PAGO</p>
          <h1 className="page-title">Órdenes de Pago</h1>
          <p className="text-sm text-gray-500 mt-0.5">Solicitudes de pago vía transferencia (Nómina · Materiales · General)</p>
        </div>
        <button onClick={() => openOrderModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva orden
        </button>
      </div>

        <div className="space-y-4">

          {/* Filtros + acciones masivas */}
          <div className="flex flex-wrap items-center gap-2">
            {canFilterStatus && (['', 'PENDING', 'PAID'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === s ? 'bg-primary-500 text-gray-900' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {s === '' ? 'Todas' : s === 'PENDING' ? '🕐 Pendientes' : '✅ Pagadas'}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1 self-stretch" />
            {(['', 'SERVICIO', 'PAYROLL', 'MATERIALS'] as const).map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === t ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {t === '' ? 'Todos tipos' : ORDER_TYPE_CFG[t as OrderType].label}
              </button>
            ))}
            {orders.filter((o) => o.generatedText).length > 1 && (
              <>
                <div className="w-px bg-gray-200 mx-1 self-stretch" />
                <button
                  onClick={() => copyText(orders.filter((o) => o.generatedText).map((o, i) => `${i + 1}. ${o.generatedText}`).join('\n\n─────────────\n\n'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-all">
                  <ClipboardCopy className="w-3.5 h-3.5" /> Copiar todas
                </button>
                <button
                  onClick={() => shareWhatsApp(orders.filter((o) => o.generatedText).map((o, i) => `${i + 1}. ${o.generatedText}`).join('\n\n─────────────\n\n'), () => flash('📋 Copiado — pega en WhatsApp Web'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-all">
                  <MessageCircle className="w-3.5 h-3.5" /> Compartir todas
                </button>
              </>
            )}
          </div>

          {/* Detalle expandido */}
          {viewingOrder && (
            <div className="card p-5 space-y-4 border-l-4 border-primary-400">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-mono">OP-{String(viewingOrder.number).padStart(3, '0')}</span>
                    <TypeBadge type={viewingOrder.orderType} />
                    <StatusBadge status={viewingOrder.status} />
                  </div>
                  <p className="font-bold text-gray-900 mt-1 text-base">{viewingOrder.payingCompany}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{viewingOrder.concept}</p>
                  <p className="text-lg font-bold text-primary-700 mt-1">{fmtMonto(viewingOrder.amount, viewingOrder.currency)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-mono">{viewingOrder.project.code}</span>
                    {' — '}{viewingOrder.project.name}
                  </p>
                </div>
                <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              {/* Vínculo nómina */}
              {viewingOrder.orderType === 'PAYROLL' && (
                <div className={`rounded-xl p-3 border text-sm ${viewingOrder.payroll ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">📋 Nómina vinculada</p>
                    {viewingOrder.status !== 'VOIDED' && !viewingOrder.payroll && (
                      <button onClick={() => setLinkPayrollModal(true)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-300 px-2 py-0.5 rounded-lg">
                        + Vincular nómina existente
                      </button>
                    )}
                  </div>
                  {viewingOrder.payroll ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-blue-800">
                          {PAYROLL_TYPE_LABEL[viewingOrder.payroll.type]} #{viewingOrder.payroll.number}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          viewingOrder.payroll.status === 'PAID'    ? 'bg-green-100 text-green-700' :
                          viewingOrder.payroll.status === 'APPROVED'? 'bg-blue-100 text-blue-700'  :
                          'bg-amber-100 text-amber-700'}`}>
                          {viewingOrder.payroll.status}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600">
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
                <div className={`rounded-xl p-3 border text-sm ${viewingOrder.expense ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">🧾 Gasto vinculado</p>
                    {viewingOrder.status !== 'VOIDED' && (
                      viewingOrder.expense
                        ? <button onClick={() => { if (confirm('¿Desvincular gasto?')) unlinkExpenseMut.mutate(viewingOrder.id); }}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold">
                            <Unlink className="w-3 h-3" /> Desvincular
                          </button>
                        : <button onClick={() => { setSelectedExpenseId(''); setLinkModal(true); }}
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-semibold">
                            <Link className="w-3 h-3" /> Vincular gasto
                          </button>
                    )}
                  </div>
                  {viewingOrder.expense ? (
                    <div>
                      <p className="font-semibold text-amber-800">{viewingOrder.expense.description}</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {fmtMonto(viewingOrder.expense.amount, viewingOrder.currency)}
                        &nbsp;·&nbsp; {fmtDate(viewingOrder.expense.expenseDate)}
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold ${viewingOrder.expense.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
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
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-1">📋 Contrato ajustado vinculado</p>
                  <p className="font-semibold text-indigo-800">{(viewingOrder as any).contratoAjustado.descripcionTrabajo}</p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    Monto contrato: {fmtMonto((viewingOrder as any).contratoAjustado.montoContratado, viewingOrder.currency)}
                    &nbsp;·&nbsp; Estado: {(viewingOrder as any).contratoAjustado.estado}
                  </p>
                  <p className="text-xs text-indigo-500 mt-1">
                    El gasto generado quedará registrado como avance de este contrato.
                  </p>
                </div>
              )}

              {/* Mensaje de pago */}
              {viewingOrder.generatedText && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📱 Mensaje WhatsApp</p>
                  <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                    {viewingOrder.generatedText}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button onClick={() => copyText(viewingOrder.generatedText!)} className="btn-secondary text-sm flex items-center gap-2">
                      <ClipboardCopy className="w-4 h-4" /> Copiar
                    </button>
                    <button
                      onClick={() => shareWhatsApp(viewingOrder.generatedText!, () => flash('📋 Copiado — pega en WhatsApp Web'))}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-all">
                      <MessageCircle className="w-4 h-4" /> Compartir por WhatsApp
                    </button>
                  </div>
                </div>
              )}

              {/* Revertir a Pendiente — cuando gasto vinculado fue rechazado */}
              {isAdmin && viewingOrder.status === 'PAID' && viewingOrder.expense?.status === 'REJECTED' && (
                <div className="pt-2 border-t border-orange-100">
                  <button
                    onClick={() => { if (confirm('¿Revertir esta orden a PENDIENTE? Se limpiará la información de pago.')) revertToPendingMut.mutate(viewingOrder.id); }}
                    disabled={revertToPendingMut.isPending}
                    className="w-full text-xs text-orange-700 font-bold border border-orange-300 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5">
                    ↩️ Revertir a Pendiente (gasto rechazado)
                  </button>
                </div>
              )}

              {/* Eliminar permanente — admin */}
              {isAdmin && (
                <div className="pt-2 border-t border-red-100">
                  <button
                    onClick={() => { if (confirm('⚠️ ¿ELIMINAR esta orden PERMANENTEMENTE? No se puede deshacer.')) hardDeleteOrderMut.mutate(viewingOrder.id); }}
                    disabled={hardDeleteOrderMut.isPending}
                    className="w-full text-xs text-red-700 font-bold border border-red-300 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all">
                    🗑 Eliminar permanentemente (Admin)
                  </button>
                </div>
              )}

              {/* Acciones */}
              {viewingOrder.status !== 'VOIDED' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {/* Editar: PENDING para admin/auxiliar/financiero, PAID solo admin */}
                  {!isAuxiliar && userRole !== 'supervisor' && (viewingOrder.status === 'PENDING' || (isAdmin && viewingOrder.status === 'PAID')) && (
                    <button onClick={() => openOrderModal(viewingOrder)} className="btn-secondary text-sm flex items-center gap-2">
                      <Pencil className="w-3.5 h-3.5" />
                      {isAdmin && viewingOrder.status === 'PAID' ? 'Editar (Admin)' : 'Editar'}
                    </button>
                  )}
                  {/* Marcar como pagada + Anular: solo PENDING */}
                  {viewingOrder.status === 'PENDING' && (
                    <>
                      <button onClick={() => openPayModal(viewingOrder)}
                        className="btn-primary text-sm flex items-center gap-2" disabled={markPaidMut.isPending}>
                        {markPaidMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                        Marcar como pagada
                      </button>
                      <button onClick={() => { if (confirm('¿Anular esta orden de pago?')) voidOrderMut.mutate(viewingOrder.id); }}
                        className="text-sm text-red-600 hover:text-red-700 border border-red-300 hover:bg-red-50 px-3 py-2 rounded-lg font-semibold transition-all">
                        Anular
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Comprobante de transferencia — solo cuando está PAID */}
              {viewingOrder.status === 'PAID' && (viewingOrder.paymentReference || viewingOrder.paymentBank) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm space-y-1">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Transferencia</p>
                  {viewingOrder.paymentReference && (
                    <p className="text-gray-700">
                      <span className="font-semibold text-gray-500">No. transacción:</span>{' '}
                      <span className="font-mono">{viewingOrder.paymentReference}</span>
                    </p>
                  )}
                  {viewingOrder.paymentBank && (
                    <p className="text-gray-700">
                      <span className="font-semibold text-gray-500">Banco emisor:</span>{' '}
                      {viewingOrder.paymentBank}
                    </p>
                  )}
                </div>
              )}

              {/* Generar gasto retroactivo — solo para SERVICIO y MATERIALS, no PAYROLL */}
              {viewingOrder.status === 'PAID' && !viewingOrder.expenseId && viewingOrder.orderType !== 'PAYROLL' && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Esta orden no tiene gasto registrado en el proyecto.
                  </p>
                  <button
                    onClick={() => generateExpenseMut.mutate(viewingOrder.id)}
                    disabled={generateExpenseMut.isPending}
                    className="text-sm text-primary-600 hover:text-primary-700 border border-primary-300 hover:bg-primary-50 px-3 py-2 rounded-lg font-semibold transition-all flex items-center gap-1.5">
                    {generateExpenseMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Generar gasto
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lista de órdenes */}
          <div className="card overflow-hidden">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-12 gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay órdenes de pago{filterStatus || filterType ? ' con ese filtro' : ''}.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Beneficiario</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr key={o.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${viewingOrder?.id === o.id ? 'bg-primary-50' : ''}`}
                      onClick={() => setViewingOrder(viewingOrder?.id === o.id ? null : o)}>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">OP-{String(o.number).padStart(3, '0')}</td>
                      <td className="px-4 py-3"><TypeBadge type={o.orderType} /></td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{o.supplier.name}</p>
                        <p className="text-xs text-gray-400">{o.supplier.bank ?? ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-gray-500">{o.project.code}</p>
                        <p className="text-xs text-gray-700 font-medium leading-tight">{o.project.name}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{fmtMonto(o.amount, o.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={(e) => { e.stopPropagation(); copyText(o.generatedText ?? ''); }}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Copiar mensaje">
                            <ClipboardCopy className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); shareWhatsApp(o.generatedText ?? '', () => flash('📋 Copiado — pega en WhatsApp Web')); }}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Compartir por WhatsApp">
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

      {/* ── MODAL: ORDEN DE PAGO ────────────────────────────── */}
      {orderModal && (
        <Modal title={editingOrder ? '✏️ Editar orden' : '💳 Nueva orden de pago'} onClose={closeOrderModal} wide>

          {/* ── VISTA: ÉXITO (batch mode) ─────────────────── */}
          {modalView === 'success' && lastCreatedOrder && (
            <div className="space-y-5">
              {/* Banner éxito */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-800">¡Orden generada exitosamente!</p>
                  <p className="text-sm text-green-700">
                    OP-{String(lastCreatedOrder.number).padStart(3, '0')}
                    &nbsp;·&nbsp; {lastCreatedOrder.supplier.name}
                    &nbsp;·&nbsp; {fmtMonto(lastCreatedOrder.amount, lastCreatedOrder.currency)}
                  </p>
                  {sessionOrders.length > 1 && (
                    <p className="text-xs text-green-600 mt-1 font-semibold">
                      {sessionOrders.length} órdenes generadas en esta sesión
                    </p>
                  )}
                </div>
              </div>

              {/* Mensaje generado */}
              {lastCreatedOrder.generatedText && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📱 Mensaje para enviar</p>
                  <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                    {lastCreatedOrder.generatedText}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button onClick={() => copyText(lastCreatedOrder.generatedText!)}
                      className="btn-secondary text-sm flex items-center gap-2">
                      <ClipboardCopy className="w-4 h-4" /> Copiar
                    </button>
                    <button onClick={() => shareWhatsApp(lastCreatedOrder.generatedText!, () => flash('📋 Copiado — pega en WhatsApp Web'))}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-all">
                      <MessageCircle className="w-4 h-4" /> Compartir por WhatsApp
                    </button>
                  </div>
                </div>
              )}

              {/* Resumen de sesión (si hay más de una) */}
              {sessionOrders.length > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">📋 Órdenes de esta sesión ({sessionOrders.length})</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => copyText(sessionOrders.map((o, i) => `${i + 1}. ${o.generatedText ?? ''}`).join('\n\n-------------\n\n'))}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-all">
                        <ClipboardCopy className="w-3 h-3" /> Copiar todas
                      </button>
                      <button
                        onClick={() => shareWhatsApp(sessionOrders.map((o, i) => `${i + 1}. ${o.generatedText ?? ''}`).join('\n\n-------------\n\n'), () => flash('📋 Copiado — pega en WhatsApp Web'))}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-all">
                        <MessageCircle className="w-3 h-3" /> Compartir todas
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {sessionOrders.map((o, i) => (
                      <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-xs text-gray-400 font-mono shrink-0">{i + 1}. OP-{String(o.number).padStart(3, '0')}</span>
                        <span className="text-gray-700 truncate mx-3 flex-1">{o.supplier.name}</span>
                        <span className="text-gray-500 shrink-0 text-xs">{fmtMonto(o.amount, o.currency)}</span>
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => copyText(o.generatedText ?? '')} title="Copiar"
                            className="p-1 text-gray-400 hover:text-primary-600 rounded">
                            <ClipboardCopy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => shareWhatsApp(o.generatedText ?? '', () => flash('📋 Copiado — pega en WhatsApp Web'))} title="WhatsApp"
                            className="p-1 text-gray-400 hover:text-green-600 rounded">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={crearOtraOrden}
                  className="btn-secondary flex items-center gap-2 flex-1 justify-center">
                  <Plus className="w-4 h-4" /> Crear otra orden
                </button>
                <button onClick={closeOrderModal}
                  className="btn-primary flex items-center gap-2 flex-1 justify-center">
                  <CheckCircle className="w-4 h-4" /> Cerrar
                </button>
              </div>
            </div>
          )}

          {/* ── VISTA: FORMULARIO ─────────────────────────── */}
          {modalView === 'form' && (
            <>
              {formErr && <AlertBox msg={formErr} />}

              {/* Tipo de orden */}
              <div className="mb-5">
                <label className="label">Tipo de orden *</label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(ORDER_TYPE_CFG) as OrderType[]).map((t) => {
                    const cfg = ORDER_TYPE_CFG[t];
                    return (
                      <button key={t} type="button"
                        onClick={() => setOrderForm((f) => ({
                          ...f,
                          orderType: t,
                          payrollId: '',
                          quotationId: '',
                          ...(!editingOrder ? { amount: '', concept: '' } : {}),
                        }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${orderForm.orderType === t ? cfg.color + ' border-opacity-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <div className={`mb-1 ${orderForm.orderType === t ? 'text-gray-800' : 'text-gray-400'}`}>{cfg.icon}</div>
                        <p className={`text-xs font-bold ${orderForm.orderType === t ? 'text-gray-800' : 'text-gray-600'}`}>{cfg.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{cfg.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Empresa pagadora *">
                  <input className="input-field" placeholder="SERVINGMI SRL" value={orderForm.payingCompany}
                    onChange={(e) => setOrderForm((f) => ({ ...f, payingCompany: e.target.value }))} />
                </Field>
                <Field label="Proyecto *">
                  <select className="input-field" value={orderForm.projectId}
                    onChange={(e) => setOrderForm((f) => ({ ...f, projectId: e.target.value, payrollId: '', contratoAjustadoId: '' }))}>
                    <option value="">— Selecciona —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </Field>
              </div>

              {/* PAYROLL: campos de período + tipo (solo en creación) */}
              {orderForm.orderType === 'PAYROLL' && !editingOrder && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 mb-1">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                    👷 Datos de la nómina — se creará automáticamente
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-blue-800 mb-1">Período inicio *</label>
                      <input type="date" className="input-field text-sm"
                        value={orderForm.payrollPeriodStart}
                        onChange={(e) => setOrderForm((f) => ({ ...f, payrollPeriodStart: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-blue-800 mb-1">Período fin *</label>
                      <input type="date" className="input-field text-sm"
                        value={orderForm.payrollPeriodEnd}
                        onChange={(e) => setOrderForm((f) => ({ ...f, payrollPeriodEnd: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">
                    ✅ Al generar la orden, la nómina se crea y aprueba automáticamente con los datos anteriores.
                  </p>
                </div>
              )}

              {/* Info nómina — cuando se está editando */}
              {orderForm.orderType === 'PAYROLL' && editingOrder && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-2">
                  <strong>👷 Orden de Nómina:</strong> Los datos del período no se pueden modificar desde aquí. Edita la nómina directamente desde el módulo Nóminas si es necesario.
                </div>
              )}

              {/* Info materiales */}
              {orderForm.orderType === 'MATERIALS' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-2">
                  <strong>📦 Orden de Materiales:</strong> El gasto se vincula desde el detalle una vez que la transferencia sea confirmada y registrada.
                </div>
              )}

              <Field label="Suplidor / Beneficiario *">
                <select className="input-field" value={orderForm.supplierId}
                  onChange={(e) => { setOrderForm((f) => ({ ...f, supplierId: e.target.value, bankAccountId: '', contratoAjustadoId: '' })); setSupplierSearch(''); }}>
                  <option value="">— Selecciona suplidor —</option>
                  {activeSuppliers
                    .filter((s) => (s.bankAccounts && s.bankAccounts.length > 0) || (s.bank && s.accountNumber))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                {activeSuppliers.filter((s) => (!s.bankAccounts || s.bankAccounts.length === 0) && (!s.bank || !s.accountNumber)).length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Solo se muestran suplidores con datos bancarios. Actualiza los demás desde Directorio de Suplidores.
                  </p>
                )}
              </Field>

              {orderForm.supplierId && (() => {
                const s = activeSuppliers.find((x) => x.id === orderForm.supplierId);
                if (!s) return null;
                const accounts = s.bankAccounts ?? [];
                // Multiple accounts → show selector
                if (accounts.length > 1) {
                  const selected = accounts.find((a) => a.id === orderForm.bankAccountId) ?? accounts.find((a) => a.isDefault) ?? accounts[0];
                  return (
                    <div className="-mt-2 mb-4 space-y-1.5">
                      <select
                        className="input-field text-sm"
                        value={orderForm.bankAccountId || selected?.id || ''}
                        onChange={(e) => setOrderForm((f) => ({ ...f, bankAccountId: e.target.value }))}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            🏦 {a.bank} · {a.accountType} · {a.accountNumber}{a.isDefault ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                // Single account or legacy fields
                const acc = accounts[0];
                const bank    = acc?.bank          ?? s.bank;
                const accType = acc?.accountType   ?? s.accountType;
                const accNum  = acc?.accountNumber ?? s.accountNumber;
                if (!bank && !accNum) return (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 -mt-2 mb-4">
                    ⚠️ Este suplidor no tiene cuentas bancarias registradas. Agrégalas en el directorio de suplidores.
                  </div>
                );
                return (
                  <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 border border-gray-200 -mt-2 mb-4">
                    🏦 <strong>{bank}</strong> &nbsp;·&nbsp; {accType} &nbsp;·&nbsp;
                    <span className="font-mono">{accNum}</span>
                    {s.cedula && <> &nbsp;·&nbsp; {s.cedula}</>}
                    {s.rnc    && <> &nbsp;·&nbsp; RNC: {s.rnc}</>}
                  </div>
                );
              })()}

              {/* Contrato ajustado — solo si hay contratos activos para proyecto+suplidor */}
              {availableContracts.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-1">
                  <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wide mb-1.5">
                    📋 Vincular a contrato ajustado <span className="font-normal text-indigo-500 normal-case">(opcional)</span>
                  </label>
                  <select
                    className="input-field text-sm"
                    value={orderForm.contratoAjustadoId}
                    onChange={(e) => setOrderForm((f) => ({ ...f, contratoAjustadoId: e.target.value }))}
                  >
                    <option value="">— Sin contrato ajustado —</option>
                    {availableContracts.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.descripcionTrabajo} · RD$ {Number(c.montoContratado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                  {orderForm.contratoAjustadoId && (
                    <p className="text-xs text-indigo-600 mt-1">
                      ✅ El gasto generado quedará vinculado automáticamente a este contrato como avance.
                    </p>
                  )}
                </div>
              )}

              {/* Cotización abierta — solo si tipo=SERVICIO y hay cotizaciones activas para proyecto+suplidor */}
              {orderForm.orderType === 'SERVICIO' && availableQuotations.length > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-1">
                  <label className="block text-xs font-bold text-teal-700 uppercase tracking-wide mb-1.5">
                    📄 Vincular a cotización abierta <span className="font-normal text-teal-500 normal-case">(opcional)</span>
                  </label>
                  <select
                    className="input-field text-sm"
                    value={orderForm.quotationId}
                    onChange={(e) => setOrderForm((f) => ({ ...f, quotationId: e.target.value }))}
                  >
                    <option value="">— Sin cotización vinculada —</option>
                    {availableQuotations.map((q: any) => (
                      <option key={q.id} value={q.id}>
                        COTI-{String(q.number).padStart(3, '0')} · {q.description?.slice(0, 50)}{q.description?.length > 50 ? '…' : ''} · {q.currency} {Number(q.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                  {orderForm.quotationId && (
                    <p className="text-xs text-teal-600 mt-1">
                      ✅ Al confirmar el pago, el gasto quedará vinculado automáticamente a esta cotización como factura parcial.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Monto *">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field"
                    placeholder="0.00"
                    value={fmtAmountInput(orderForm.amount)}
                    onChange={(e) => {
                      const raw = parseAmountInput(e.target.value);
                      if (/^[0-9]*\.?[0-9]{0,2}$/.test(raw) || raw === '') {
                        setOrderForm((f) => ({ ...f, amount: raw }));
                      }
                    }}
                  />
                </Field>
                <Field label="Moneda *">
                  <select className="input-field" value={orderForm.currency}
                    onChange={(e) => setOrderForm((f) => ({ ...f, currency: e.target.value }))}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0">Concepto / Descripción *</label>
                  <button
                    type="button"
                    onClick={handleSuggestConcept}
                    disabled={conceptLoading}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors font-medium disabled:opacity-50"
                  >
                    {conceptLoading
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Generando...</>
                      : <><Sparkles className="w-3 h-3" /> Generar con IA</>
                    }
                  </button>
                </div>
                <textarea className="input-field resize-none" rows={2} placeholder="Pago de servicios..."
                  value={orderForm.concept} onChange={(e) => setOrderForm((f) => ({ ...f, concept: e.target.value }))} />
              </div>

              <Field label="Notas (opcional)">
                <input className="input-field" placeholder="Información adicional" value={orderForm.notes}
                  onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} />
              </Field>

              <ModalFooter onCancel={closeOrderModal} onSave={saveOrder}
                saving={createOrderMut.isPending || updateOrderMut.isPending}
                label={editingOrder ? 'Guardar cambios' : 'Generar orden'} />
            </>
          )}
        </Modal>
      )}

      {/* ── MODAL: VINCULAR GASTO ───────────────────────────── */}
      {linkModal && viewingOrder && (
        <Modal title="🧾 Vincular gasto de materiales" onClose={() => setLinkModal(false)}>
          <p className="text-sm text-gray-500 mb-4">
            Selecciona el gasto por transferencia registrado en el proyecto <strong>{viewingOrder.project.code}</strong> que corresponde a esta orden.
          </p>
          {availableExpenses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No hay gastos por transferencia disponibles en este proyecto.</p>
              <p className="text-xs mt-1">Registra el gasto primero desde el módulo de Gastos.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableExpenses.map((e: any) => (
                <label key={e.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedExpenseId === e.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="expense" value={e.id} className="mt-1"
                    checked={selectedExpenseId === e.id} onChange={() => setSelectedExpenseId(e.id)} />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{e.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
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

      {/* ── MODAL: VINCULAR NÓMINA ─────────────────────────── */}
      {linkPayrollModal && viewingOrder && (
        <Modal title="📋 Vincular nómina a esta orden" onClose={() => { setLinkPayrollModal(false); setSelectedPayrollId(''); }}>
          {projectPayrolls.filter((p: any) => p.status === 'APPROVED').length === 0 ? (
            <div className="text-center py-4 text-gray-400">
              <p className="text-sm">No hay nóminas aprobadas para este proyecto.</p>
              <p className="text-xs mt-1">Solo se pueden vincular nóminas con estado <strong>Aprobada</strong>.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {projectPayrolls.filter((p: any) => p.status === 'APPROVED').map((p: any) => (
                <label key={p.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPayrollId === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="payroll-select" checked={selectedPayrollId === p.id}
                    onChange={() => setSelectedPayrollId(p.id)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      NOM-{String(p.number).padStart(3, '0')} — {p.description || p.type}
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${p.status === 'PAID' ? 'bg-green-100 text-green-700' : p.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'PAID' ? 'Pagada' : p.status === 'APPROVED' ? 'Aprobada' : 'Borrador'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
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

      {/* ── Modal: Confirmar pago + comprobante fiscal ─────────── */}
      {payModal && payingOrder && (
        <Modal
          title="Confirmar pago"
          onClose={closePayModal}
          size="md"
        >
          <div className="space-y-4">
            {/* Resumen de la orden */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold text-gray-800">
                OP-{String(payingOrder.number).padStart(3, '0')} — {payingOrder.concept}
              </p>
              <p className="text-gray-500">
                {payingOrder.supplier?.name} · RD$ {Number(payingOrder.amount).toLocaleString('es-DO')}
              </p>
            </div>

            {/* ¿Tiene comprobante fiscal? */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fiscalForm.hasFiscal}
                onChange={(e) => setFiscalForm((f) => ({ ...f, hasFiscal: e.target.checked, ncf: '', supplierRnc: payingOrder.supplier?.rnc ?? '', supplierName: payingOrder.supplier?.name ?? '' }))}
                className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
              />
              <span className="text-sm font-medium text-gray-700">Tiene comprobante fiscal (NCF / e-NCF)</span>
            </label>

            {/* Campos fiscales */}
            {fiscalForm.hasFiscal && (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    NCF / e-NCF <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fiscalForm.ncf}
                    onChange={(e) => setFiscalForm((f) => ({ ...f, ncf: e.target.value.toUpperCase() }))}
                    placeholder="B0100000001 o E310000000001"
                    maxLength={13}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">NCF: 11 chars (ej. B0100000001) · e-NCF: 13 chars (ej. E310000000001)</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">RNC del suplidor <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={fiscalForm.supplierRnc}
                      onChange={(e) => setFiscalForm((f) => ({ ...f, supplierRnc: e.target.value }))}
                      placeholder="101000000"
                      maxLength={11}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del suplidor <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={fiscalForm.supplierName}
                      onChange={(e) => setFiscalForm((f) => ({ ...f, supplierName: e.target.value }))}
                      placeholder="Razón social"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ITBIS (RD$)</label>
                  <input
                    type="number"
                    value={fiscalForm.itbisAmount}
                    onChange={(e) => setFiscalForm((f) => ({ ...f, itbisAmount: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
              </div>
            )}

            {/* Información de transferencia */}
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transferencia (opcional)</p>
              {/* Tasa de cambio — solo para divisas extranjeras */}
              {payingOrder.currency !== 'RD$' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    💱 Orden en {payingOrder.currency} — Tasa de cambio requerida
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-semibold text-gray-600 shrink-0">
                      1 {payingOrder.currency} = RD$
                    </label>
                    <input
                      type="number"
                      value={payInfoForm.exchangeRate}
                      onChange={(e) => setPayInfoForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                      placeholder="ej. 60.50"
                      min="0.01"
                      step="0.01"
                      className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                  {payInfoForm.exchangeRate && Number(payInfoForm.exchangeRate) > 0 && (
                    <p className="text-xs text-amber-700">
                      Equivalente: RD$ {(Number(payingOrder.amount) * Number(payInfoForm.exchangeRate)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">No. de transacción</label>
                  <input
                    type="text"
                    value={payInfoForm.paymentReference}
                    onChange={(e) => setPayInfoForm((f) => ({ ...f, paymentReference: e.target.value }))}
                    placeholder="ej. 123456789"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Banco emisor</label>
                  <input
                    type="text"
                    value={payInfoForm.paymentBank}
                    onChange={(e) => setPayInfoForm((f) => ({ ...f, paymentBank: e.target.value }))}
                    placeholder="ej. BHD, BanReservas"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
              </div>
            </div>

            {fiscalErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{fiscalErr}</p>}
          </div>

          <ModalFooter
            onCancel={closePayModal}
            onSave={() => {
              setFiscalErr('');
              const isForeignOrder = payingOrder.currency !== 'RD$';
              if (isForeignOrder && !payInfoForm.exchangeRate) {
                setFiscalErr(`Debe ingresar la tasa de cambio para órdenes en ${payingOrder.currency}`);
                return;
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
                if (!validateNcf(ncf)) {
                  setFiscalErr('Formato de NCF inválido. Ej: B0100000001 (NCF) o E310000000001 (e-NCF)'); return;
                }
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

// ── Sub-componentes ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: any }) {
  const normalized: OrderType = ['SERVICIO', 'PAYROLL', 'MATERIALS'].includes(type) ? type : 'SERVICIO';
  const cls: Record<OrderType, string> = {
    SERVICIO:  'bg-purple-100 text-purple-700',
    PAYROLL:   'bg-blue-100 text-blue-700',
    MATERIALS: 'bg-amber-100 text-amber-700',
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls[normalized]}`}>{ORDER_TYPE_CFG[normalized].label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-4"><label className="label">{label}</label>{children}</div>;
}

function AlertBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-600">{msg}</p>
    </div>
  );
}

function Modal({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-base">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, label }: { onCancel: () => void; onSave: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 mt-2 justify-end">
      <button onClick={onCancel} className="btn-secondary">Cancelar</button>
      <button onClick={onSave} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><CheckCircle className="w-4 h-4" /> {label}</>}
      </button>
    </div>
  );
}
