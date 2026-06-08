import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, ArrowLeft, Phone, Mail, MapPin, Hash, FileText,
  Receipt, BarChart3, CheckCircle, AlertCircle, X, Pencil,
  ToggleLeft, ToggleRight, StickyNote, Sparkles, CreditCard, DollarSign,
} from 'lucide-react';
import { suppliersApi } from '../../api';
import { useRole }       from '../../hooks/useRole';
import { fmtDate }       from '../../utils/date';
import type { Supplier } from '../../types';

// ── Formato moneda ─────────────────────────────────────────────
function fmtDOP(amount: number) {
  return new Intl.NumberFormat('es-DO', {
    style:                 'currency',
    currency:              'DOP',
    minimumFractionDigits: 0,
  }).format(amount);
}

// ── Badges de estado cotización ────────────────────────────────
const QUOTATION_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:          { label: 'Pendiente',       cls: 'bg-gray-100 text-gray-600'   },
  APPROVED:         { label: 'Aprobada',        cls: 'bg-blue-100 text-blue-700'   },
  ADVANCE_PAID:     { label: 'Anticipo pagado', cls: 'bg-purple-100 text-purple-700' },
  IN_PROGRESS:      { label: 'En progreso',     cls: 'bg-amber-100 text-amber-700'  },
  PARTIAL_INVOICED: { label: 'Fact. parcial',   cls: 'bg-orange-100 text-orange-700' },
  INVOICED:         { label: 'Facturada',       cls: 'bg-indigo-100 text-indigo-700' },
  PAID:             { label: 'Pagada',          cls: 'bg-green-100 text-green-700'  },
  CANCELLED:        { label: 'Cancelada',       cls: 'bg-red-100 text-red-600'      },
};

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  PAID:    { label: 'Pagada',    cls: 'bg-green-100 text-green-700' },
  VOIDED:  { label: 'Anulada',   cls: 'bg-red-100 text-red-600'    },
};

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'] as const;

// ── Tipos de formulario ────────────────────────────────────────
type SupplierForm = {
  name:          string;
  rnc:           string;
  cedula:        string;
  phone:         string;
  email:         string;
  address:       string;
  notes:         string;
  bank:          string;
  accountType:   string;
  accountNumber: string;
};

function supplierToForm(s: Supplier): SupplierForm {
  return {
    name:          s.name,
    rnc:           s.rnc           ?? '',
    cedula:        s.cedula        ?? '',
    phone:         s.phone         ?? '',
    email:         s.email         ?? '',
    address:       s.address       ?? '',
    notes:         s.notes         ?? '',
    bank:          s.bank          ?? '',
    accountType:   s.accountType   ?? '',
    accountNumber: s.accountNumber ?? '',
  };
}

function formToPayload(f: SupplierForm) {
  return {
    name:          f.name.trim(),
    rnc:           f.rnc.trim()           || null,
    cedula:        f.cedula.trim()        || null,
    phone:         f.phone.trim()         || null,
    email:         f.email.trim()         || null,
    address:       f.address.trim()       || null,
    notes:         f.notes.trim()         || null,
    bank:          f.bank.trim()          || null,
    accountType:   f.accountType.trim()   || null,
    accountNumber: f.accountNumber.trim() || null,
  };
}

// ── Componente ─────────────────────────────────────────────────
export default function SupplierDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const qc      = useQueryClient();
  const role    = useRole();

  const [activeTab, setActiveTab]   = useState<'quotations' | 'vouchers' | 'office' | 'payments'>('quotations');
  const [editModal,  setEditModal]  = useState(false);
  const [form,       setForm]       = useState<SupplierForm>({
    name: '', rnc: '', cedula: '', phone: '', email: '', address: '', notes: '',
    bank: '', accountType: '', accountNumber: '',
  });
  const [apiError, setApiError] = useState('');
  const [apiOk,    setApiOk]    = useState('');

  // ── Queries ─────────────────────────────────────────────────
  const { data: histData, isLoading } = useQuery({
    queryKey: ['supplier-history', id],
    queryFn:  () => suppliersApi.getHistory(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const supplier = histData?.supplier;
  const stats    = histData?.stats;

  // ── Mutations ────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: unknown) => suppliersApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-history', id] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setApiOk('Suplidor actualizado');
      setEditModal(false);
    },
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al actualizar'),
  });

  const toggleMutation = useMutation({
    mutationFn: () => suppliersApi.toggleActive(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-history', id] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al cambiar estado'),
  });

  // ── Handlers ─────────────────────────────────────────────────
  function openEdit() {
    if (!supplier) return;
    setForm(supplierToForm(supplier));
    setApiError('');
    setEditModal(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');
    const payload = formToPayload(form);
    if (!payload.name || payload.name.length < 2) {
      setApiError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    if (payload.rnc && payload.rnc.length !== 9 && payload.rnc.length !== 11) {
      setApiError('El RNC debe tener 9 u 11 dígitos');
      return;
    }
    updateMutation.mutate(payload);
  }

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
        <Building2 className="w-10 h-10 opacity-30 animate-pulse" />
        <p>Cargando suplidor...</p>
      </div>
    );
  }

  if (!supplier || !stats) {
    return (
      <div className="card p-10 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Suplidor no encontrado</p>
        <Link to="/suppliers" className="btn-secondary mt-4 inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Volver al directorio
        </Link>
      </div>
    );
  }

  const quotations     = histData?.quotations     ?? [];
  const fiscalVouchers = histData?.fiscalVouchers ?? [];
  const officeExpenses = histData?.officeExpenses ?? [];
  const paymentOrders  = histData?.paymentOrders  ?? [];

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Breadcrumb */}
      <Link
        to="/suppliers"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al directorio de suplidores
      </Link>

      {/* Feedback */}
      {apiOk && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{apiOk}</span>
          <button onClick={() => setApiOk('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {apiError && !editModal && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{apiError}</span>
          <button onClick={() => setApiError('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Card de info del suplidor */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          {/* Icono */}
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: supplier.isActive ? '#F5C218' : '#E5E7EB' }}>
            <Building2 className="w-6 h-6 text-gray-900" />
          </div>

          {/* Datos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title">{supplier.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                supplier.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {supplier.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {supplier.rnc && (
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  RNC: <span className="font-mono">{supplier.rnc}</span>
                </span>
              )}
              {supplier.cedula && (
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  Cédula: <span className="font-mono">{supplier.cedula}</span>
                </span>
              )}
              {supplier.phone && (
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {supplier.phone}
                </span>
              )}
              {supplier.email && (
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {supplier.email}
                </span>
              )}
              {supplier.address && (
                <span className="text-sm text-gray-600 flex items-center gap-2 sm:col-span-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {supplier.address}
                </span>
              )}
              {supplier.notes && (
                <span className="text-sm text-gray-500 flex items-start gap-2 sm:col-span-2">
                  <StickyNote className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  {supplier.notes}
                </span>
              )}
            </div>

            {/* Bank data */}
            {(supplier.bank || supplier.accountNumber) && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                <CreditCard className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {supplier.bank && (
                  <span className="text-sm text-gray-600">{supplier.bank}</span>
                )}
                {supplier.accountType && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {supplier.accountType.replace('Cuenta ', '')}
                  </span>
                )}
                {supplier.accountNumber && (
                  <span className="font-mono text-sm text-gray-700">{supplier.accountNumber}</span>
                )}
              </div>
            )}
          </div>

          {/* Acciones */}
          {role.canManageSuppliers && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openEdit}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
              <button
                onClick={() => toggleMutation.mutate()}
                disabled={toggleMutation.isPending}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  supplier.isActive
                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                    : 'border-green-200 text-green-700 hover:bg-green-50'
                }`}
              >
                {supplier.isActive
                  ? <><ToggleRight className="w-4 h-4" /> Desactivar</>
                  : <><ToggleLeft  className="w-4 h-4" /> Activar</>
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total cotizado"    value={fmtDOP(stats.totalQuoted)}               icon={<BarChart3 className="w-4 h-4" />}    color="amber"  />
        <StatCard label="Total pagado"      value={fmtDOP(stats.totalPaid)}                 icon={<CheckCircle className="w-4 h-4" />}  color="green"  />
        <StatCard label="Órdenes de pago"   value={fmtDOP(stats.totalPaymentOrders ?? 0)}   icon={<DollarSign className="w-4 h-4" />}   color="blue"   />
        <StatCard label="Gastos oficina"    value={fmtDOP(stats.totalOfficeExpenses ?? 0)}  icon={<Sparkles className="w-4 h-4" />}     color="purple" />
        <StatCard label="Cotizaciones"      value={String(stats.quotationCount)}             icon={<FileText className="w-4 h-4" />}     color="purple" />
        <StatCard label="Proyectos"         value={String(stats.projectCount)}               icon={<Building2 className="w-4 h-4" />}   color="gray"   />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          <button
            onClick={() => setActiveTab('quotations')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'quotations'
                ? 'border-amber-400 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Cotizaciones ({quotations.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'payments'
                ? 'border-amber-400 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Órdenes de pago ({paymentOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'vouchers'
                ? 'border-amber-400 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Comprobantes fiscales ({fiscalVouchers.length})
          </button>
          <button
            onClick={() => setActiveTab('office')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'office'
                ? 'border-amber-400 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Gastos de oficina ({officeExpenses.length})
          </button>
        </nav>
      </div>

      {/* Contenido de tabs */}
      {activeTab === 'quotations' && (
        <>
          {quotations.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-10 h-10 text-gray-200" />}
              message="No hay cotizaciones registradas para este suplidor"
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">No.</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pagado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {quotations.map((q) => {
                      const paid   = q.payments.reduce((s, p) => s + Number(p.amount), 0);
                      const status = QUOTATION_STATUS[q.status] ?? { label: q.status, cls: 'bg-gray-100 text-gray-600' };
                      const total  = q.currency === 'DOP'
                        ? fmtDOP(Number(q.total))
                        : `${q.currency} ${Number(q.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
                      return (
                        <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-gray-700">
                            COTI-{String(q.number).padStart(3, '0')}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(q.quotationDate)}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded mr-1">
                              {q.project.code}
                            </span>
                            <span className="text-gray-600 text-xs">{q.project.name}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">{total}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{paid > 0 ? fmtDOP(paid) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'payments' && (
        <>
          {paymentOrders.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="w-10 h-10 text-gray-200" />}
              message="No hay órdenes de pago registradas para este suplidor"
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">No.</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Concepto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paymentOrders.map((po) => {
                      const status = ORDER_STATUS[po.status] ?? { label: po.status, cls: 'bg-gray-100 text-gray-600' };
                      const amount = po.currency === 'DOP'
                        ? fmtDOP(Number(po.amount))
                        : `${po.currency} ${Number(po.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
                      return (
                        <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-gray-700">
                            OP-{String(po.number).padStart(4, '0')}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                              {po.orderType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{po.concept}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded mr-1">
                              {po.project.code}
                            </span>
                            <span className="text-gray-600 text-xs">{po.project.name}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">{amount}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {po.paidAt ? fmtDate(po.paidAt) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'vouchers' && (
        <>
          {fiscalVouchers.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-10 h-10 text-gray-200" />}
              message={
                supplier.rnc
                  ? 'No hay comprobantes fiscales registrados para este suplidor'
                  : 'Este suplidor no tiene RNC registrado — los comprobantes se buscan por RNC'
              }
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">NCF</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fiscalVouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{v.ncf}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtDate(v.expense.expenseDate)}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded mr-1">
                            {v.expense.project.code}
                          </span>
                          <span className="text-gray-600 text-xs">{v.expense.project.name}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{v.expense.description}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {fmtDOP(Number(v.expense.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'office' && (
        <>
          {officeExpenses.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-10 h-10 text-gray-200" />}
              message="No hay gastos de oficina vinculados a este suplidor"
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Método</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {officeExpenses.map((oe) => (
                      <tr key={oe.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(oe.expenseDate)}</td>
                        <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{oe.description}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs capitalize">{oe.category.replace(/_/g, ' ').toLowerCase()}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{
                          ({ CASH: 'Efectivo', TRANSFER: 'Transf.', CARD: 'Tarjeta', CHECK: 'Cheque', OTHER: 'Otro' })[oe.paymentMethod] ?? oe.paymentMethod
                        }</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">{fmtDOP(Number(oe.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de edición */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-900">Editar suplidor</h3>
              <button
                onClick={() => { setEditModal(false); setApiError(''); }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              <div>
                <label className="label">Nombre <span className="text-red-500">*</span></label>
                <input className="input-field" name="name" value={form.name} onChange={handleChange}
                  required minLength={2} maxLength={200} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">RNC</label>
                  <input className="input-field" name="rnc" value={form.rnc} onChange={handleChange}
                    placeholder="9 u 11 dígitos" maxLength={11} />
                </div>
                <div>
                  <label className="label">Cédula</label>
                  <input className="input-field" name="cedula" value={form.cedula} onChange={handleChange}
                    placeholder="000-0000000-0" maxLength={20} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input-field" name="phone" value={form.phone} onChange={handleChange}
                    placeholder="809-000-0000" maxLength={20} />
                </div>
                <div>
                  <label className="label">Correo electrónico</label>
                  <input className="input-field" name="email" type="email" value={form.email}
                    onChange={handleChange} maxLength={150} />
                </div>
              </div>

              <div>
                <label className="label">Dirección</label>
                <input className="input-field" name="address" value={form.address} onChange={handleChange}
                  maxLength={500} />
              </div>

              <div>
                <label className="label">Notas</label>
                <textarea className="input-field resize-none" name="notes" value={form.notes}
                  onChange={handleChange} rows={2} maxLength={1000} />
              </div>

              {/* Bank data section */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5" /> Datos bancarios
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="label">Banco</label>
                    <input className="input-field" name="bank" value={form.bank} onChange={handleChange}
                      placeholder="BanReservas, Popular, BHD..." maxLength={100} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Tipo de cuenta</label>
                      <select className="input-field" name="accountType" value={form.accountType} onChange={handleChange}>
                        <option value="">Seleccionar...</option>
                        {ACCOUNT_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Número de cuenta</label>
                      <input className="input-field" name="accountNumber" value={form.accountNumber}
                        onChange={handleChange} placeholder="0000000000" maxLength={50} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setEditModal(false); setApiError(''); }}
                  className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {updateMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Guardar cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────
function StatCard({
  label, value, icon, color,
}: {
  label: string;
  value: string;
  icon:  React.ReactNode;
  color: 'amber' | 'green' | 'blue' | 'purple' | 'gray';
}) {
  const colorMap: Record<string, string> = {
    amber:  'bg-amber-50  border-amber-200  text-amber-600',
    green:  'bg-green-50  border-green-200  text-green-600',
    blue:   'bg-blue-50   border-blue-200   text-blue-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    gray:   'bg-gray-50   border-gray-200   text-gray-600',
  };
  return (
    <div className={`card p-4 border ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-gray-500 text-sm max-w-sm mx-auto">{message}</p>
    </div>
  );
}
