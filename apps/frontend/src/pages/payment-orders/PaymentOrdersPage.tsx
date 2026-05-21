import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, CheckCircle, AlertCircle, Loader2,
  CreditCard, Pencil, PowerOff, ClipboardCopy, X, BadgeCheck, Clock,
} from 'lucide-react';
import { beneficiariesApi, paymentOrdersApi, projectsApi } from '../../api';
import type { Beneficiary, PaymentOrder } from '../../types';

// ── Tipos locales ─────────────────────────────────────────────
type Tab = 'orders' | 'beneficiaries';

type BeneForm = {
  name: string; bank: string;
  accountType: string; accountNumber: string;
  cedula: string; phone: string;
};
const EMPTY_BENE: BeneForm = { name: '', bank: '', accountType: 'Cuenta de Ahorros', accountNumber: '', cedula: '', phone: '' };

type OrderForm = {
  payingCompany: string; beneficiaryId: string; projectId: string;
  amount: string; currency: string; concept: string; notes: string;
};
const EMPTY_ORDER: OrderForm = {
  payingCompany: '', beneficiaryId: '', projectId: '',
  amount: '', currency: 'RD$', concept: '', notes: '',
};

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'];
const CURRENCIES    = ['RD$', 'US$', '€'];

const STATUS_CFG = {
  PENDING: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700',   icon: <Clock className="w-3 h-3" /> },
  PAID:    { label: 'Pagada',    cls: 'bg-green-100 text-green-700',   icon: <BadgeCheck className="w-3 h-3" /> },
  VOIDED:  { label: 'Anulada',   cls: 'bg-gray-100 text-gray-500',    icon: <X className="w-3 h-3" /> },
} as const;

const ACCT_BADGE: Record<string, string> = {
  'Cuenta de Ahorros': 'bg-blue-100 text-blue-700',
  'Cuenta Corriente':  'bg-amber-100 text-amber-700',
  'Cuenta Nómina':     'bg-green-100 text-green-700',
};

function fmtMonto(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ────────────────────────────────────────────────────────────────
export default function PaymentOrdersPage() {
  const qc  = useQueryClient();
  const [tab, setTab] = useState<Tab>('orders');

  // ── Orden activa para ver detalle / copiar texto ──────────────
  const [viewingOrder, setViewingOrder] = useState<PaymentOrder | null>(null);

  // ── Notificaciones ────────────────────────────────────────────
  const [toast, setToast] = useState('');
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Filtros lista de órdenes ──────────────────────────────────
  const [filterStatus, setFilterStatus] = useState('');

  // ── Modales ───────────────────────────────────────────────────
  const [beneModal,  setBeneModal]  = useState(false);
  const [orderModal, setOrderModal] = useState(false);
  const [editingBene,  setEditingBene]  = useState<Beneficiary | null>(null);
  const [editingOrder, setEditingOrder] = useState<PaymentOrder | null>(null);

  const [beneForm,  setBeneForm]  = useState<BeneForm>(EMPTY_BENE);
  const [orderForm, setOrderForm] = useState<OrderForm>(EMPTY_ORDER);
  const [formErr,   setFormErr]   = useState('');

  // ── Queries ───────────────────────────────────────────────────
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['payment-orders', filterStatus],
    queryFn:  () => paymentOrdersApi.list(filterStatus ? { status: filterStatus } : {}),
    select:   (r) => (r.data as any).data as PaymentOrder[],
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

  // ── Beneficiary mutations ─────────────────────────────────────
  const createBeneMut = useMutation({
    mutationFn: (d: unknown) => beneficiariesApi.create(d),
    onSuccess: () => { invalidateBenes(); closeBeneModal(); flash('✅ Beneficiario guardado'); },
    onError:   (e: any) => setFormErr(e.response?.data?.error || 'Error al guardar'),
  });
  const updateBeneMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: unknown }) => beneficiariesApi.update(id, d),
    onSuccess: () => { invalidateBenes(); closeBeneModal(); flash('✅ Beneficiario actualizado'); },
    onError:   (e: any) => setFormErr(e.response?.data?.error || 'Error al actualizar'),
  });
  const deactivateBeneMut = useMutation({
    mutationFn: (id: string) => beneficiariesApi.deactivate(id),
    onSuccess: () => { invalidateBenes(); flash('🗑 Beneficiario desactivado'); },
    onError:   (e: any) => flash(e.response?.data?.error || 'Error'),
  });
  const invalidateBenes = () => {
    qc.invalidateQueries({ queryKey: ['beneficiaries'] });
  };

  // ── Payment order mutations ───────────────────────────────────
  const createOrderMut = useMutation({
    mutationFn: (d: unknown) => paymentOrdersApi.create(d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
      closeOrderModal();
      flash('✅ Orden de pago generada');
      setViewingOrder(res.data.data);
    },
    onError: (e: any) => setFormErr(e.response?.data?.error || 'Error al crear'),
  });
  const updateOrderMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: unknown }) => paymentOrdersApi.update(id, d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
      closeOrderModal();
      flash('✅ Orden actualizada');
      setViewingOrder(res.data.data);
    },
    onError: (e: any) => setFormErr(e.response?.data?.error || 'Error'),
  });
  const markPaidMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.markAsPaid(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
      setViewingOrder(res.data.data);
      flash('✅ Orden marcada como pagada');
    },
    onError: (e: any) => flash(e.response?.data?.error || 'Error'),
  });
  const voidOrderMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.void(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
      setViewingOrder(res.data.data);
      flash('Orden anulada');
    },
    onError: (e: any) => flash(e.response?.data?.error || 'Error'),
  });

  // ── Beneficiary modal helpers ─────────────────────────────────
  const openBeneModal = (b?: Beneficiary) => {
    setEditingBene(b ?? null);
    setBeneForm(b
      ? { name: b.name, bank: b.bank, accountType: b.accountType, accountNumber: b.accountNumber, cedula: b.cedula ?? '', phone: b.phone ?? '' }
      : EMPTY_BENE
    );
    setFormErr('');
    setBeneModal(true);
  };
  const closeBeneModal = () => { setBeneModal(false); setEditingBene(null); setBeneForm(EMPTY_BENE); setFormErr(''); };

  const saveBene = () => {
    if (!beneForm.name.trim())          return setFormErr('El nombre es requerido');
    if (!beneForm.bank.trim())           return setFormErr('El banco es requerido');
    if (!beneForm.accountNumber.trim())  return setFormErr('El número de cuenta es requerido');
    const payload = { ...beneForm, cedula: beneForm.cedula || undefined, phone: beneForm.phone || undefined };
    if (editingBene) { updateBeneMut.mutate({ id: editingBene.id, d: payload }); }
    else             { createBeneMut.mutate(payload); }
  };

  // ── Order modal helpers ───────────────────────────────────────
  const openOrderModal = (o?: PaymentOrder) => {
    setEditingOrder(o ?? null);
    setOrderForm(o
      ? { payingCompany: o.payingCompany, beneficiaryId: o.beneficiaryId, projectId: o.projectId,
          amount: String(o.amount), currency: o.currency, concept: o.concept, notes: o.notes ?? '' }
      : EMPTY_ORDER
    );
    setFormErr('');
    setOrderModal(true);
  };
  const closeOrderModal = () => { setOrderModal(false); setEditingOrder(null); setOrderForm(EMPTY_ORDER); setFormErr(''); };

  const saveOrder = () => {
    if (!orderForm.payingCompany.trim()) return setFormErr('La empresa pagadora es requerida');
    if (!orderForm.beneficiaryId)        return setFormErr('Selecciona un beneficiario');
    if (!orderForm.projectId)            return setFormErr('Selecciona un proyecto');
    if (!orderForm.amount || Number(orderForm.amount) <= 0) return setFormErr('El monto debe ser mayor a 0');
    if (!orderForm.concept.trim())       return setFormErr('El concepto es requerido');

    const payload = {
      payingCompany: orderForm.payingCompany,
      beneficiaryId: orderForm.beneficiaryId,
      projectId:     orderForm.projectId,
      amount:        Number(orderForm.amount),
      currency:      orderForm.currency,
      concept:       orderForm.concept,
      notes:         orderForm.notes || undefined,
    };
    if (editingOrder) { updateOrderMut.mutate({ id: editingOrder.id, d: payload }); }
    else              { createOrderMut.mutate(payload); }
  };

  const autofillBene = (id: string) => {
    setOrderForm((f) => ({ ...f, beneficiaryId: id }));
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => flash('📋 Texto copiado'));
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Órdenes de Pago
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Genera y gestiona órdenes de pago a beneficiarios</p>
        </div>
        <div className="flex gap-2">
          {tab === 'orders' && (
            <button onClick={() => openOrderModal()} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nueva orden
            </button>
          )}
          {tab === 'beneficiaries' && (
            <button onClick={() => openBeneModal()} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nuevo beneficiario
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['orders', 'Órdenes de Pago'], ['beneficiaries', 'Beneficiarios']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: ÓRDENES ─────────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {(['', 'PENDING', 'PAID'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  filterStatus === s
                    ? 'bg-primary-500 text-gray-900'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s === '' ? 'Todas' : s === 'PENDING' ? 'Pendientes' : 'Pagadas'}
              </button>
            ))}
          </div>

          {/* Detalle expandido de la orden seleccionada */}
          {viewingOrder && (
            <div className="card p-5 border-l-4 border-primary-400 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">OP-{String(viewingOrder.number).padStart(3, '0')}</span>
                    <StatusBadge status={viewingOrder.status} />
                  </div>
                  <p className="font-bold text-gray-900 mt-1">{viewingOrder.payingCompany}</p>
                  <p className="text-sm text-gray-500">{viewingOrder.concept}</p>
                </div>
                <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Texto generado */}
              {viewingOrder.generatedText && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Mensaje de pago</p>
                  <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                    {viewingOrder.generatedText}
                  </div>
                  <button
                    onClick={() => copyText(viewingOrder.generatedText!)}
                    className="mt-2 btn-secondary text-sm flex items-center gap-2"
                  >
                    <ClipboardCopy className="w-4 h-4" /> Copiar mensaje
                  </button>
                </div>
              )}

              {/* Acciones */}
              {viewingOrder.status === 'PENDING' && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => openOrderModal(viewingOrder)} className="btn-secondary text-sm flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => { if (confirm('¿Marcar esta orden como pagada?')) markPaidMut.mutate(viewingOrder.id); }}
                    className="btn-primary text-sm flex items-center gap-2"
                    disabled={markPaidMut.isPending}
                  >
                    {markPaidMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                    Marcar como pagada
                  </button>
                  <button
                    onClick={() => { if (confirm('¿Anular esta orden de pago?')) voidOrderMut.mutate(viewingOrder.id); }}
                    className="text-sm text-red-600 hover:text-red-700 border border-red-300 hover:bg-red-50 px-3 py-2 rounded-lg font-semibold transition-all"
                  >
                    Anular
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lista */}
          <div className="card overflow-hidden">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando órdenes...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay órdenes de pago{filterStatus ? ' con ese filtro' : ''}.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Beneficiario</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${viewingOrder?.id === o.id ? 'bg-primary-50' : ''}`}
                      onClick={() => setViewingOrder(viewingOrder?.id === o.id ? null : o)}
                    >
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">OP-{String(o.number).padStart(3, '0')}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{o.beneficiary.name}</p>
                        <p className="text-xs text-gray-400">{o.beneficiary.bank}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{o.project.code}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{fmtMonto(Number(o.amount), o.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); copyText(o.generatedText ?? ''); }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                          title="Copiar mensaje"
                        >
                          <ClipboardCopy className="w-4 h-4" />
                        </button>
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
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay beneficiarios registrados.</p>
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
                        : <span className="text-xs text-gray-400">Inactivo</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openBeneModal(b)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {b.isActive && (
                          <button
                            onClick={() => { if (confirm(`¿Desactivar a "${b.name}"?`)) deactivateBeneMut.mutate(b.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Desactivar"
                          >
                            <PowerOff className="w-4 h-4" />
                          </button>
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
            <Field label="Nombre / Empresa *">
              <input className="input-field" placeholder="Juan Pérez o ABC SRL"
                value={beneForm.name} onChange={(e) => setBeneForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Banco *">
              <input className="input-field" placeholder="Banco Popular"
                value={beneForm.bank} onChange={(e) => setBeneForm((f) => ({ ...f, bank: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de cuenta *">
              <select className="input-field" value={beneForm.accountType}
                onChange={(e) => setBeneForm((f) => ({ ...f, accountType: e.target.value }))}>
                {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Número de cuenta *">
              <input className="input-field font-mono" placeholder="000-00000-0"
                value={beneForm.accountNumber} onChange={(e) => setBeneForm((f) => ({ ...f, accountNumber: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cédula / RNC (opcional)">
              <input className="input-field" placeholder="001-0000000-0"
                value={beneForm.cedula} onChange={(e) => setBeneForm((f) => ({ ...f, cedula: e.target.value }))} />
            </Field>
            <Field label="Teléfono (opcional)">
              <input className="input-field" placeholder="809-000-0000"
                value={beneForm.phone} onChange={(e) => setBeneForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
          </div>
          <ModalFooter onCancel={closeBeneModal} onSave={saveBene}
            saving={createBeneMut.isPending || updateBeneMut.isPending}
            label={editingBene ? 'Guardar cambios' : 'Registrar'} />
        </Modal>
      )}

      {/* ── MODAL: ORDEN DE PAGO ────────────────────────────── */}
      {orderModal && (
        <Modal title={editingOrder ? '✏️ Editar orden de pago' : '💳 Nueva orden de pago'} onClose={closeOrderModal} wide>
          {formErr && <AlertBox msg={formErr} />}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Empresa pagadora *">
              <input className="input-field" placeholder="SERVINGMI SRL"
                value={orderForm.payingCompany} onChange={(e) => setOrderForm((f) => ({ ...f, payingCompany: e.target.value }))} />
            </Field>
            <Field label="Proyecto *">
              <select className="input-field" value={orderForm.projectId}
                onChange={(e) => setOrderForm((f) => ({ ...f, projectId: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Beneficiario *">
            <select className="input-field" value={orderForm.beneficiaryId}
              onChange={(e) => autofillBene(e.target.value)}>
              <option value="">— Selecciona un beneficiario —</option>
              {activeBenes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.bank} · {b.accountNumber}
                </option>
              ))}
            </select>
          </Field>

          {/* Preview datos bancarios */}
          {orderForm.beneficiaryId && (() => {
            const b = activeBenes.find((x) => x.id === orderForm.beneficiaryId);
            return b ? (
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 border border-gray-200">
                🏦 <strong>{b.bank}</strong> &nbsp;·&nbsp; {b.accountType} &nbsp;·&nbsp;
                <span className="font-mono">{b.accountNumber}</span>
                {b.cedula && <>&nbsp;·&nbsp; {b.cedula}</>}
              </div>
            ) : null;
          })()}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Monto *">
              <input type="number" min="0.01" step="0.01" className="input-field" placeholder="0.00"
                value={orderForm.amount} onChange={(e) => setOrderForm((f) => ({ ...f, amount: e.target.value }))} />
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
            <input className="input-field" placeholder="Información adicional"
              value={orderForm.notes} onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>

          <ModalFooter onCancel={closeOrderModal} onSave={saveOrder}
            saving={createOrderMut.isPending || updateOrderMut.isPending}
            label={editingOrder ? 'Guardar cambios' : 'Generar orden'} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function AlertBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-600">{msg}</p>
    </div>
  );
}

function Modal({ title, onClose, wide = false, children }: {
  title: string; onClose: () => void; wide?: boolean; children: React.ReactNode;
}) {
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

function ModalFooter({ onCancel, onSave, saving, label }: {
  onCancel: () => void; onSave: () => void; saving: boolean; label: string;
}) {
  return (
    <div className="flex gap-3 mt-2 justify-end">
      <button onClick={onCancel} className="btn-secondary">Cancelar</button>
      <button onClick={onSave} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><CheckCircle className="w-4 h-4" /> {label}</>}
      </button>
    </div>
  );
}
