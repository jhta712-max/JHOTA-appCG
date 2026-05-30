import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, CheckCircle, AlertCircle, Loader2,
  CreditCard, Pencil, PowerOff, ClipboardCopy, X,
  BadgeCheck, Clock, Wallet, Link, Unlink, ShoppingCart,
  Upload, Download, MessageCircle,
} from 'lucide-react';
import { beneficiariesApi, paymentOrdersApi, projectsApi } from '../../api';
import type { Beneficiary, PaymentOrder } from '../../types';

// ── Tipos locales ─────────────────────────────────────────────
type Tab       = 'orders' | 'beneficiaries';
type OrderType = 'GENERAL' | 'PAYROLL' | 'MATERIALS';
type ModalView = 'form' | 'success';

type BeneForm = { name: string; bank: string; accountType: string; accountNumber: string; cedula: string; phone: string };
const EMPTY_BENE: BeneForm = { name: '', bank: '', accountType: 'Cuenta de Ahorros', accountNumber: '', cedula: '', phone: '' };

type OrderForm = {
  orderType: OrderType; payingCompany: string; beneficiaryId: string;
  projectId: string; amount: string; currency: string; concept: string;
  notes: string; payrollId: string;
};
const EMPTY_ORDER: OrderForm = {
  orderType: 'GENERAL', payingCompany: '', beneficiaryId: '', projectId: '',
  amount: '', currency: 'RD$', concept: '', notes: '', payrollId: '',
};

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'];
const CURRENCIES    = ['RD$', 'US$', '€'];

const ORDER_TYPE_CFG: Record<OrderType, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  GENERAL:   { label: 'General',    icon: <FileText className="w-4 h-4" />,      color: 'border-gray-300 bg-gray-50',     desc: 'Pago libre sin vínculo' },
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

function downloadBeneTemplate() {
  const csv = [
    'nombre,banco,tipoCuenta,numeroCuenta,cedula_rnc,telefono',
    // Persona física con cédula
    'Juan Pérez,Banco Popular,Cuenta de Ahorros,000-000000-0,001-0000000-0,809-000-0000',
    // Empresa con RNC (9 dígitos, formato XXX-XXXXX-X)
    'Ferretería ABC SRL,BHD León,Cuenta Corriente,001-111111-1,1-31-91767-4,',
    // También se aceptan variantes cortas en tipoCuenta:
    'Pedro Díaz,Banreservas,Ahorro,9606780159,,809-111-2222',
    'Corporación XYZ,Banco Santa Cruz,Corriente,0710016620,1-05-04879-5,',
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'plantilla-beneficiarios.csv'; a.click();
  URL.revokeObjectURL(url);
}

function parseCSVText(text: string): BeneForm[] {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  // Eliminar BOM si existe (UTF-8 BOM = EF BB BF o el carácter ﻿)
  const headerLine = lines[0].replace(/^﻿/, '');
  // Normalizar encabezados: minúsculas, quitar tildes manualmente, solo letras y _
  const stripAccents = (s: string) => s
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
  const headers = headerLine
    .split(',')
    .map((h) => stripAccents(h.trim().toLowerCase()).replace(/[^a-z_]/g, ''));
  const idx = (name: string) => {
    // Busca coincidencia exacta o parcial
    const exact = headers.indexOf(name);
    if (exact !== -1) return exact;
    return headers.findIndex((h) => h.includes(name));
  };

  return lines.slice(1).map((line) => {
    // Parseo de campos respetando comillas
    const vals: string[] = [];
    let cur = ''; let inQ = false;
    for (const ch of line + ',') {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    const g = (name: string, fallback = '') => vals[idx(name)]?.trim() || fallback;

    // Buscar cédula/RNC por varios nombres de columna posibles
    const cedulaRaw = g('cedula_rnc') || g('cedula') || g('rnc') || '';

    return {
      name:          g('nombre'),
      bank:          g('banco'),
      accountType:   normalizeAccountType(g('tipocuenta', '')),
      accountNumber: g('numerocuenta'),
      cedula:        cedulaRaw,
      phone:         g('telefono'),
    };
  }).filter((r) => r.name.trim() && r.bank.trim() && r.accountNumber.trim());
}

// ── WhatsApp share ────────────────────────────────────────────
// isMobile: true en Android/iPhone → usa Web Share API nativa (emoji intactos)
// Desktop: WhatsApp Web corrompe emoji via URL → copiamos al portapapeles directo
const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

async function shareWhatsApp(text: string, onCopied?: () => void) {
  if (isMobileDevice()) {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* cancelado */ }
    }
    // Fallback móvil sin Web Share API
    window.open(`whatsapp://send?text=${encodeURIComponent(text)}`, '_blank');
  } else {
    // Desktop: copiar al portapapeles (WA Web corrompe emoji en URL)
    await navigator.clipboard.writeText(text);
    onCopied?.();
  }
}

// ────────────────────────────────────────────────────────────────
export default function PaymentOrdersPage() {
  const qc = useQueryClient();
  const [tab, setTab]               = useState<Tab>('orders');
  const [viewingOrder, setViewingOrder] = useState<PaymentOrder | null>(null);
  const [toast, setToast]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');

  // Modales
  const [beneModal,   setBeneModal]   = useState(false);
  const [orderModal,  setOrderModal]  = useState(false);
  const [linkModal,   setLinkModal]   = useState(false);
  const [importModal, setImportModal] = useState(false);

  // Estado del modal de orden (batch mode)
  const [modalView,         setModalView]         = useState<ModalView>('form');
  const [lastCreatedOrder,  setLastCreatedOrder]   = useState<PaymentOrder | null>(null);
  const [sessionOrders,     setSessionOrders]      = useState<PaymentOrder[]>([]);

  // Importación CSV
  const [importRows,     setImportRows]     = useState<BeneForm[]>([]);
  const [importProgress, setImportProgress] = useState<'idle' | 'importing' | 'done'>('idle');
  const [importResults,  setImportResults]  = useState({ ok: 0, err: 0 });
  const [importErrors,   setImportErrors]   = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingBene,  setEditingBene]  = useState<Beneficiary | null>(null);
  const [editingOrder, setEditingOrder] = useState<PaymentOrder | null>(null);
  const [beneForm,  setBeneForm]  = useState<BeneForm>(EMPTY_BENE);
  const [orderForm, setOrderForm] = useState<OrderForm>(EMPTY_ORDER);
  const [formErr,   setFormErr]   = useState('');
  const [selectedExpenseId, setSelectedExpenseId] = useState('');

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  // ── Queries ───────────────────────────────────────────────────
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['payment-orders', filterStatus, filterType],
    queryFn:  () => paymentOrdersApi.list({
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterType   ? { orderType: filterType } : {}),
    }),
    select: (r) => (r.data as any).data as PaymentOrder[],
  });

  const { data: beneficiaries = [], isLoading: loadingBenes } = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn:  () => beneficiariesApi.list(false),
    select:   (r) => r.data.data,
  });

  const { data: activeBenes = [] } = useQuery({
    queryKey: ['beneficiaries', 'active'],
    queryFn:  () => beneficiariesApi.list(true),
    select:   (r) => r.data.data,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'active'],
    queryFn:  () => projectsApi.list({ status: 'ACTIVE', limit: 100 }),
    select:   (r) => r.data.data,
  });

  // availablePayrolls: ya no se requiere — órdenes de Nómina son independientes del módulo de nóminas

  const linkingOrderProjectId = viewingOrder?.projectId ?? '';
  const { data: availableExpenses = [] } = useQuery({
    queryKey: ['payment-orders', 'expenses', linkingOrderProjectId],
    queryFn:  () => paymentOrdersApi.availableExpenses(linkingOrderProjectId),
    select:   (r) => r.data.data,
    enabled:  linkModal && !!linkingOrderProjectId,
  });

  // ── Beneficiary mutations ─────────────────────────────────────
  const createBeneMut = useMutation({
    mutationFn: (d: unknown) => beneficiariesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['beneficiaries'] }); closeBeneModal(); flash('✅ Beneficiario guardado'); },
    onError:   (e: any) => setFormErr(e.response?.data?.error || 'Error al guardar'),
  });
  const updateBeneMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: unknown }) => beneficiariesApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['beneficiaries'] }); closeBeneModal(); flash('✅ Beneficiario actualizado'); },
    onError:   (e: any) => setFormErr(e.response?.data?.error || 'Error'),
  });
  const deactivateBeneMut = useMutation({
    mutationFn: (id: string) => beneficiariesApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['beneficiaries'] }); flash('🗑 Beneficiario desactivado'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error'),
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
    mutationFn: (id: string) => paymentOrdersApi.markAsPaid(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payment-orders'] }); setViewingOrder(res.data.data); flash('✅ Orden marcada como pagada'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error'),
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

  // ── Bene modal helpers ────────────────────────────────────────
  const openBeneModal = (b?: Beneficiary) => {
    setEditingBene(b ?? null);
    setBeneForm(b ? { name: b.name, bank: b.bank, accountType: b.accountType, accountNumber: b.accountNumber, cedula: b.cedula ?? '', phone: b.phone ?? '' } : EMPTY_BENE);
    setFormErr(''); setBeneModal(true);
  };
  const closeBeneModal = () => { setBeneModal(false); setEditingBene(null); setBeneForm(EMPTY_BENE); setFormErr(''); };
  const saveBene = () => {
    if (!beneForm.name.trim())         return setFormErr('El nombre es requerido');
    if (!beneForm.bank.trim())          return setFormErr('El banco es requerido');
    if (!beneForm.accountNumber.trim()) return setFormErr('El número de cuenta es requerido');
    const payload = { ...beneForm, cedula: beneForm.cedula || undefined, phone: beneForm.phone || undefined };
    if (editingBene) updateBeneMut.mutate({ id: editingBene.id, d: payload });
    else             createBeneMut.mutate(payload);
  };

  // ── Order modal helpers ───────────────────────────────────────
  const openOrderModal = (o?: PaymentOrder) => {
    setEditingOrder(o ?? null);
    setOrderForm(o
      ? { orderType: o.orderType, payingCompany: o.payingCompany, beneficiaryId: o.beneficiaryId,
          projectId: o.projectId, amount: String(o.amount), currency: o.currency,
          concept: o.concept, notes: o.notes ?? '', payrollId: o.payrollId ?? '' }
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
    if (!orderForm.beneficiaryId)        return setFormErr('Selecciona un beneficiario');
    if (!orderForm.projectId)            return setFormErr('Selecciona un proyecto');
    if (!orderForm.amount || Number(orderForm.amount) <= 0) return setFormErr('El monto debe ser mayor a 0');
    if (!orderForm.concept.trim())       return setFormErr('El concepto es requerido');

    const payload: any = {
      orderType:     orderForm.orderType,
      payingCompany: orderForm.payingCompany,
      beneficiaryId: orderForm.beneficiaryId,
      projectId:     orderForm.projectId,
      amount:        Number(orderForm.amount),
      currency:      orderForm.currency,
      concept:       orderForm.concept,
      notes:         orderForm.notes || undefined,
    };

    if (editingOrder) updateOrderMut.mutate({ id: editingOrder.id, d: payload });
    else              createOrderMut.mutate(payload);
  };

  const copyText = (text: string) => { navigator.clipboard.writeText(text).then(() => flash('📋 Texto copiado')); };

  // ── Import CSV helpers ────────────────────────────────────────
  const closeImportModal = () => { setImportModal(false); setImportRows([]); setImportProgress('idle'); setImportResults({ ok: 0, err: 0 }); setImportErrors([]); };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      const rows = parseCSVText(text);
      if (rows.length === 0) flash('No se encontraron filas válidas en el archivo.');
      setImportRows(rows);
    };
    reader.readAsText(file, 'UTF-8');
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const runImport = async () => {
    setImportProgress('importing');
    setImportErrors([]);
    try {
      const payload = importRows.map((r) => ({
        name:          r.name,
        bank:          r.bank,
        accountType:   r.accountType,
        accountNumber: r.accountNumber,
        cedula:        r.cedula || undefined,
        phone:         r.phone  || undefined,
      }));
      const res = await beneficiariesApi.bulkCreate(payload);
      const { ok, err, results } = res.data.data;
      const errs = results
        .filter((r) => r.status === 'error')
        .map((r) => `"${r.name}": ${r.error}`);
      setImportResults({ ok, err });
      setImportErrors(errs);
      if (ok > 0) qc.invalidateQueries({ queryKey: ['beneficiaries'] });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Error de conexión';
      setImportErrors([msg]);
      setImportResults({ ok: 0, err: importRows.length });
    }
    setImportProgress('done');
  };

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
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" /> Órdenes de Pago
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Solicitudes de pago vía transferencia (Nómina · Materiales · General)</p>
        </div>
        <div className="flex gap-2">
          {tab === 'orders' && (
            <button onClick={() => openOrderModal()} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nueva orden
            </button>
          )}
          {tab === 'beneficiaries' && (
            <>
              <button onClick={() => setImportModal(true)} className="btn-secondary flex items-center gap-2">
                <Upload className="w-4 h-4" /> Importar
              </button>
              <button onClick={() => openBeneModal()} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nuevo beneficiario
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['orders', 'Órdenes de Pago'], ['beneficiaries', 'Beneficiarios']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: ÓRDENES ─────────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="space-y-4">

          {/* Filtros + acciones masivas */}
          <div className="flex flex-wrap items-center gap-2">
            {(['', 'PENDING', 'PAID'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === s ? 'bg-primary-500 text-gray-900' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {s === '' ? 'Todas' : s === 'PENDING' ? '🕐 Pendientes' : '✅ Pagadas'}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1 self-stretch" />
            {(['', 'GENERAL', 'PAYROLL', 'MATERIALS'] as const).map((t) => (
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
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">📋 Nómina vinculada</p>
                  {viewingOrder.payroll ? (
                    <div>
                      <p className="font-semibold text-blue-800">
                        {PAYROLL_TYPE_LABEL[viewingOrder.payroll.type]} #{viewingOrder.payroll.number}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${viewingOrder.payroll.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {viewingOrder.payroll.status}
                        </span>
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        {fmtDate(viewingOrder.payroll.periodStart)} — {fmtDate(viewingOrder.payroll.periodEnd)}
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

              {/* Acciones */}
              {viewingOrder.status === 'PENDING' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => openOrderModal(viewingOrder)} className="btn-secondary text-sm flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => { if (confirm('¿Marcar esta orden como PAGADA?')) markPaidMut.mutate(viewingOrder.id); }}
                    className="btn-primary text-sm flex items-center gap-2" disabled={markPaidMut.isPending}>
                    {markPaidMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                    Marcar como pagada
                  </button>
                  <button onClick={() => { if (confirm('¿Anular esta orden de pago?')) voidOrderMut.mutate(viewingOrder.id); }}
                    className="text-sm text-red-600 hover:text-red-700 border border-red-300 hover:bg-red-50 px-3 py-2 rounded-lg font-semibold transition-all">
                    Anular
                  </button>
                </div>
              )}

              {/* Generar gasto retroactivo — solo para GENERAL y MATERIALS, no PAYROLL */}
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
                        <p className="font-medium text-gray-900">{o.beneficiary.name}</p>
                        <p className="text-xs text-gray-400">{o.beneficiary.bank}</p>
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
      )}

      {/* ── TAB: BENEFICIARIOS ──────────────────────────────── */}
      {tab === 'beneficiaries' && (
        <div className="card overflow-hidden">
          {loadingBenes ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
          ) : beneficiaries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay beneficiarios registrados.</p>
              <button onClick={() => setImportModal(true)} className="mt-3 text-sm text-primary-600 hover:underline flex items-center gap-1 mx-auto">
                <Upload className="w-3.5 h-3.5" /> Importar desde CSV
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre / Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Banco</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuenta</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {beneficiaries.map((b) => (
                  <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${!b.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{b.name}</p>
                      {b.cedula && <p className="text-xs text-gray-400">Cédula: {b.cedula}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.bank}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold mr-1 ${ACCT_BADGE[b.accountType] ?? 'bg-gray-100 text-gray-600'}`}>
                        {b.accountType.replace('Cuenta ', '')}
                      </span>
                      <span className="font-mono text-gray-700">{b.accountNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      {b.isActive
                        ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Activo</span>
                        : <span className="text-xs text-gray-400">Inactivo</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openBeneModal(b)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                        {b.isActive && (
                          <button onClick={() => { if (confirm(`¿Desactivar a "${b.name}"?`)) deactivateBeneMut.mutate(b.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><PowerOff className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── MODAL: BENEFICIARIO ─────────────────────────────── */}
      {beneModal && (
        <Modal title={editingBene ? '✏️ Editar beneficiario' : '➕ Nuevo beneficiario'} onClose={closeBeneModal}>
          {formErr && <AlertBox msg={formErr} />}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre / Empresa *"><input className="input-field" placeholder="Juan Pérez o ABC SRL" value={beneForm.name} onChange={(e) => setBeneForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Banco *"><input className="input-field" placeholder="Banco Popular" value={beneForm.bank} onChange={(e) => setBeneForm((f) => ({ ...f, bank: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de cuenta *">
              <select className="input-field" value={beneForm.accountType} onChange={(e) => setBeneForm((f) => ({ ...f, accountType: e.target.value }))}>
                {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Número de cuenta *"><input className="input-field font-mono" placeholder="000-00000-0" value={beneForm.accountNumber} onChange={(e) => setBeneForm((f) => ({ ...f, accountNumber: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cédula / RNC (opcional)"><input className="input-field" placeholder="001-0000000-0 ó 1-31-12345-6" value={beneForm.cedula} onChange={(e) => setBeneForm((f) => ({ ...f, cedula: e.target.value }))} /></Field>
            <Field label="Teléfono (opcional)"><input className="input-field" placeholder="809-000-0000" value={beneForm.phone} onChange={(e) => setBeneForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          </div>
          <ModalFooter onCancel={closeBeneModal} onSave={saveBene} saving={createBeneMut.isPending || updateBeneMut.isPending} label={editingBene ? 'Guardar cambios' : 'Registrar'} />
        </Modal>
      )}

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
                    &nbsp;·&nbsp; {lastCreatedOrder.beneficiary.name}
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
                        onClick={() => copyText(sessionOrders.map((o, i) => `${i + 1}. ${o.generatedText ?? ''}`).join('\n\n─────────────\n\n'))}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-all">
                        <ClipboardCopy className="w-3 h-3" /> Copiar todas
                      </button>
                      <button
                        onClick={() => shareWhatsApp(sessionOrders.map((o, i) => `${i + 1}. ${o.generatedText ?? ''}`).join('\n\n─────────────\n\n'), () => flash('📋 Copiado — pega en WhatsApp Web'))}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-all">
                        <MessageCircle className="w-3 h-3" /> Compartir todas
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {sessionOrders.map((o, i) => (
                      <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-xs text-gray-400 font-mono shrink-0">{i + 1}. OP-{String(o.number).padStart(3, '0')}</span>
                        <span className="text-gray-700 truncate mx-3 flex-1">{o.beneficiary.name}</span>
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
                          // solo reinicia payrollId al cambiar tipo; conserva monto y concepto al editar
                          payrollId: '',
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
                    onChange={(e) => setOrderForm((f) => ({ ...f, projectId: e.target.value, payrollId: '' }))}>
                    <option value="">— Selecciona —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </Field>
              </div>

              {/* Info nómina */}
              {orderForm.orderType === 'PAYROLL' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-2">
                  <strong>👷 Orden de Nómina:</strong> Especifica el monto y concepto del pago de mano de obra o servicios. La orden queda registrada independientemente.
                </div>
              )}

              {/* Info materiales */}
              {orderForm.orderType === 'MATERIALS' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-2">
                  <strong>📦 Orden de Materiales:</strong> El gasto se vincula desde el detalle una vez que la transferencia sea confirmada y registrada.
                </div>
              )}

              <Field label="Beneficiario *">
                <select className="input-field" value={orderForm.beneficiaryId}
                  onChange={(e) => setOrderForm((f) => ({ ...f, beneficiaryId: e.target.value }))}>
                  <option value="">— Selecciona beneficiario —</option>
                  {activeBenes.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.bank} · {b.accountNumber}</option>)}
                </select>
              </Field>

              {orderForm.beneficiaryId && (() => {
                const b = activeBenes.find((x) => x.id === orderForm.beneficiaryId);
                return b ? (
                  <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 border border-gray-200 -mt-2 mb-4">
                    🏦 <strong>{b.bank}</strong> &nbsp;·&nbsp; {b.accountType} &nbsp;·&nbsp;
                    <span className="font-mono">{b.accountNumber}</span>
                    {b.cedula && <> &nbsp;·&nbsp; {b.cedula}</>}
                  </div>
                ) : null;
              })()}

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

              <Field label="Concepto / Descripción *">
                <textarea className="input-field resize-none" rows={2} placeholder="Pago de servicios..."
                  value={orderForm.concept} onChange={(e) => setOrderForm((f) => ({ ...f, concept: e.target.value }))} />
              </Field>

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

      {/* ── MODAL: IMPORTAR BENEFICIARIOS ──────────────────── */}
      {importModal && (
        <Modal title="📥 Importar beneficiarios" onClose={closeImportModal} wide>

          {importProgress === 'done' ? (
            /* Resultado */
            <div className="space-y-4">
              <div className="text-center py-4">
                {importResults.ok > 0
                  ? <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
                  : <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-3" />}
                <p className="text-lg font-bold text-gray-800">Importación completada</p>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{importResults.ok}</p>
                  <p className="text-xs text-green-600">importados</p>
                </div>
                {importResults.err > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{importResults.err}</p>
                    <p className="text-xs text-red-500">con error</p>
                  </div>
                )}
              </div>
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-700 mb-2">Detalle de errores:</p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {importErrors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                        <span className="shrink-0">•</span> {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                {importResults.err > 0 && (
                  <button onClick={() => { setImportProgress('idle'); }}
                    className="btn-secondary text-sm">Reintentar</button>
                )}
                <button onClick={closeImportModal} className="btn-primary">Cerrar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Paso 1: Descargar plantilla */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800 mb-1">📝 Paso 1 — Descarga la plantilla CSV</p>
                <p className="text-xs text-blue-600 mb-3">Abre el archivo en Excel, llena los datos y guárdalo como CSV.</p>
                <div className="bg-white rounded-lg border border-blue-200 px-3 py-2 mb-3 space-y-1">
                  <p className="text-xs font-mono text-blue-600">nombre, banco, tipoCuenta, numeroCuenta, cedula_rnc*, telefono*</p>
                  <div className="text-xs text-blue-500 space-y-0.5">
                    <p>• <strong>tipoCuenta:</strong> Ahorro · Corriente · Nómina (o la forma completa)</p>
                    <p>• <strong>cedula_rnc:</strong> Cédula <span className="font-mono">001-0000000-0</span> o RNC <span className="font-mono">1-31-12345-6</span> — opcional</p>
                    <p>• <strong>telefono:</strong> opcional</p>
                  </div>
                </div>
                <button onClick={downloadBeneTemplate} className="btn-secondary text-sm flex items-center gap-2">
                  <Download className="w-4 h-4" /> Descargar plantilla CSV
                </button>
              </div>

              {/* Paso 2: Cargar archivo */}
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">📂 Paso 2 — Carga el archivo completado</p>
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-semibold">
                    {importRows.length > 0
                      ? `✅ ${importRows.length} filas cargadas — haz clic para cambiar`
                      : 'Haz clic para seleccionar el archivo CSV'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Solo archivos .csv</p>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileSelected} />
                </label>
              </div>

              {/* Vista previa */}
              {importRows.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">
                    👁 Vista previa — {importRows.length} beneficiario{importRows.length !== 1 ? 's' : ''}
                  </p>
                  <div className="rounded-xl border border-gray-200 overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500">Nombre</th>
                          <th className="text-left px-3 py-2 text-gray-500">Banco</th>
                          <th className="text-left px-3 py-2 text-gray-500">Tipo</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-mono">Cuenta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importRows.map((r, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                            <td className="px-3 py-2 text-gray-600">{r.bank}</td>
                            <td className="px-3 py-2 text-gray-500">{r.accountType.replace('Cuenta ', '')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{r.accountNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button onClick={closeImportModal} className="btn-secondary">Cancelar</button>
                <button
                  onClick={runImport}
                  disabled={importRows.length === 0 || importProgress === 'importing'}
                  className="btn-primary flex items-center gap-2">
                  {importProgress === 'importing'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                    : <><Upload className="w-4 h-4" /> {importRows.length > 0 ? `Importar ${importRows.length} beneficiarios` : 'Importar'}</>}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: OrderType }) {
  const cfg: Record<OrderType, { label: string; cls: string }> = {
    GENERAL:   { label: 'General',    cls: 'bg-gray-100 text-gray-600' },
    PAYROLL:   { label: 'Nómina',     cls: 'bg-blue-100 text-blue-700' },
    MATERIALS: { label: 'Materiales', cls: 'bg-amber-100 text-amber-700' },
  };
  const c = cfg[type] ?? cfg.GENERAL;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${c.cls}`}>{c.label}</span>;
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
