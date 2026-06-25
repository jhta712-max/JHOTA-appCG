import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, ArrowLeft, Phone, Mail, MapPin, Hash, FileText,
  Receipt, BarChart3, CheckCircle, AlertCircle, X, Pencil,
  ToggleLeft, ToggleRight, StickyNote, Sparkles, CreditCard, DollarSign,
  Loader2,
} from 'lucide-react';
import { suppliersApi } from '../../api';
import { DetailPageSkeleton } from '../../components/ui/DetailPageSkeleton';
import { PAGE_META }           from '../../utils/routeMeta';
import { useRole }       from '../../hooks/useRole';
import { fmtDate }       from '../../utils/date';
import type { Supplier } from '../../types';

function fmtDOP(amount: number) {
  return new Intl.NumberFormat('es-DO', {
    style:                 'currency',
    currency:              'DOP',
    minimumFractionDigits: 0,
  }).format(amount);
}

const QUOTATION_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:          { label: 'Pendiente',       cls: 'bg-gray-100 text-gray-600'     },
  APPROVED:         { label: 'Aprobada',        cls: 'bg-blue-100 text-blue-700'     },
  ADVANCE_PAID:     { label: 'Anticipo pagado', cls: 'bg-purple-100 text-purple-700' },
  IN_PROGRESS:      { label: 'En progreso',     cls: 'bg-amber-100 text-amber-700'   },
  PARTIAL_INVOICED: { label: 'Fact. parcial',   cls: 'bg-orange-100 text-orange-700' },
  INVOICED:         { label: 'Facturada',       cls: 'bg-indigo-100 text-indigo-700' },
  PAID:             { label: 'Pagada',          cls: 'bg-green-100 text-green-700'   },
  CANCELLED:        { label: 'Cancelada',       cls: 'bg-red-100 text-red-600'       },
};

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  PAID:    { label: 'Pagada',    cls: 'bg-green-100 text-green-700' },
  VOIDED:  { label: 'Anulada',   cls: 'bg-red-100 text-red-600'    },
};

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'] as const;

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

const inputCls = "w-full border border-gray-300 rounded-none px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:ring-2 focus:ring-[#F5C218] bg-white";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 font-['Barlow_Condensed'] mb-1";

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

  const { data: histData, isLoading } = useQuery({
    queryKey: ['supplier-history', id],
    queryFn:  () => suppliersApi.getHistory(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const supplier = histData?.supplier;
  const stats    = histData?.stats;

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

  if (isLoading) {
    const meta = PAGE_META['/suppliers'];
    return (
      <div>
        <div className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5" style={{ background: '#1C1C1C' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218' }}>
              {meta.module}
            </p>
            <h1 className="text-3xl md:text-5xl uppercase tracking-widest text-white leading-none" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              {meta.title}
            </h1>
          </div>
        </div>
        <div className="p-6"><DetailPageSkeleton sections={4} /></div>
      </div>
    );
  }

  if (!supplier || !stats) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="font-['DM_Sans'] text-gray-600">Suplidor no encontrado</p>
        <Link
          to="/suppliers"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-['Barlow_Condensed'] uppercase font-bold border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al directorio
        </Link>
      </div>
    );
  }

  const quotations     = histData?.quotations     ?? [];
  const fiscalVouchers = histData?.fiscalVouchers ?? [];
  const officeExpenses = histData?.officeExpenses ?? [];
  const paymentOrders  = histData?.paymentOrders  ?? [];

  const tabs: { key: typeof activeTab; label: string; count: number }[] = [
    { key: 'quotations', label: 'Cotizaciones',          count: quotations.length     },
    { key: 'payments',   label: 'Órdenes de pago',       count: paymentOrders.length  },
    { key: 'vouchers',   label: 'Comprobantes fiscales', count: fiscalVouchers.length },
    { key: 'office',     label: 'Gastos de oficina',     count: officeExpenses.length },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* Feedback toasts */}
      {apiOk && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 text-sm font-['DM_Sans'] font-semibold shadow-lg flex items-center gap-2"
          style={{ background: '#1C1C1C', color: '#F5C218' }}
        >
          <CheckCircle className="w-4 h-4" />
          {apiOk}
          <button onClick={() => setApiOk('')} className="ml-2 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {apiError && !editModal && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 text-sm font-['DM_Sans']">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{apiError}</span>
          <button onClick={() => setApiError('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Breadcrumb */}
      <Link
        to="/suppliers"
        className="inline-flex items-center gap-2 text-sm font-['DM_Sans'] text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al directorio de suplidores
      </Link>

      {/* Hero */}
      <div className="px-4 md:px-6 py-4 md:py-5" style={{ background: '#1C1C1C' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 flex items-center justify-center shrink-0"
              style={{ background: supplier.isActive ? '#F5C218' : '#4b5563' }}
            >
              <Building2 className="w-7 h-7" style={{ color: '#1C1C1C' }} />
            </div>
            <div>
              <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-400 mb-1">
                DIRECTORIO / SUPLIDOR
              </p>
              <h1 className="font-['Barlow_Condensed'] uppercase tracking-wide text-3xl md:text-5xl text-white leading-tight">
                {supplier.name}
              </h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span
                  className="font-['Barlow_Condensed'] uppercase tracking-wide text-xs px-2 py-0.5"
                  style={supplier.isActive
                    ? { background: '#F5C218', color: '#1C1C1C' }
                    : { background: '#374151', color: '#9ca3af' }
                  }
                >
                  {supplier.isActive ? 'Activo' : 'Inactivo'}
                </span>
                {supplier.rnc && (
                  <span className="font-['Space_Mono'] text-xs text-amber-300">
                    RNC {supplier.rnc}
                  </span>
                )}
                {supplier.cedula && (
                  <span className="font-['Space_Mono'] text-xs text-gray-400">
                    Cédula {supplier.cedula}
                  </span>
                )}
              </div>
            </div>
          </div>

          {role.canManageSuppliers && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openEdit}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-['Barlow_Condensed'] uppercase font-bold transition-colors"
                style={{ background: '#F5C218', color: '#1C1C1C' }}
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                onClick={() => toggleMutation.mutate()}
                disabled={toggleMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-['Barlow_Condensed'] uppercase font-bold border transition-colors disabled:opacity-50"
                style={supplier.isActive
                  ? { borderColor: '#ef4444', color: '#fca5a5' }
                  : { borderColor: '#22c55e', color: '#86efac' }
                }
              >
                {supplier.isActive
                  ? <><ToggleRight className="w-4 h-4" /> Desactivar</>
                  : <><ToggleLeft  className="w-4 h-4" /> Activar</>
                }
              </button>
            </div>
          )}
        </div>

        {/* Contact row */}
        <div className="mt-4 flex items-center gap-6 flex-wrap">
          {supplier.phone && (
            <span className="flex items-center gap-1.5 font-['DM_Sans'] text-sm text-gray-300">
              <Phone className="w-3.5 h-3.5 text-gray-500" /> {supplier.phone}
            </span>
          )}
          {supplier.email && (
            <span className="flex items-center gap-1.5 font-['DM_Sans'] text-sm text-gray-300">
              <Mail className="w-3.5 h-3.5 text-gray-500" /> {supplier.email}
            </span>
          )}
          {supplier.address && (
            <span className="flex items-center gap-1.5 font-['DM_Sans'] text-sm text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-gray-500" /> {supplier.address}
            </span>
          )}
          {supplier.notes && (
            <span className="flex items-center gap-1.5 font-['DM_Sans'] text-sm text-gray-400 italic">
              <StickyNote className="w-3.5 h-3.5 text-gray-500" /> {supplier.notes}
            </span>
          )}
        </div>
      </div>

      {/* Bank data panel */}
      {(supplier.bank || supplier.accountNumber) && (
        <div className="border-l-4 border-[#F5C218] bg-amber-50 p-4 flex items-center gap-4 flex-wrap">
          <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
          {supplier.bank && (
            <span className="font-['DM_Sans'] font-semibold text-gray-800 text-sm">{supplier.bank}</span>
          )}
          {supplier.accountType && (
            <span className="font-['Barlow_Condensed'] uppercase text-xs px-2 py-0.5 bg-amber-100 text-amber-700">
              {supplier.accountType.replace('Cuenta ', '')}
            </span>
          )}
          {supplier.accountNumber && (
            <span className="font-['Space_Mono'] text-sm text-gray-700">{supplier.accountNumber}</span>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-200">
        <StatCard label="Total cotizado"  value={fmtDOP(stats.totalQuoted)}              icon={<BarChart3 className="w-4 h-4" />}   iconBg="#F5C218"  iconColor="#1C1C1C" />
        <StatCard label="Total pagado"    value={fmtDOP(stats.totalPaid)}                icon={<CheckCircle className="w-4 h-4" />} iconBg="#16a34a"  iconColor="#fff"    />
        <StatCard label="Órd. de pago"    value={fmtDOP(stats.totalPaymentOrders ?? 0)}  icon={<DollarSign className="w-4 h-4" />}  iconBg="#2563eb"  iconColor="#fff"    />
        <StatCard label="Gastos oficina"  value={fmtDOP(stats.totalOfficeExpenses ?? 0)} icon={<Sparkles className="w-4 h-4" />}    iconBg="#7c3aed"  iconColor="#fff"    />
        <StatCard label="Cotizaciones"    value={String(stats.quotationCount)}            icon={<FileText className="w-4 h-4" />}    iconBg="#1C1C1C"  iconColor="#F5C218" />
        <StatCard label="Proyectos"       value={String(stats.projectCount)}              icon={<Building2 className="w-4 h-4" />}   iconBg="#374151"  iconColor="#fff"    />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex min-w-max">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-sm font-['Barlow_Condensed'] uppercase tracking-wide transition-colors border-b-2 ${
                activeTab === t.key
                  ? 'border-[#F5C218] text-gray-900 font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 font-['Space_Mono'] text-xs px-1.5 py-0.5 ${
                activeTab === t.key ? 'bg-[#F5C218] text-[#1C1C1C]' : 'bg-gray-100 text-gray-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Cotizaciones */}
      {activeTab === 'quotations' && (
        quotations.length === 0 ? (
          <EmptyState icon={<FileText className="w-10 h-10 opacity-20" />} message="No hay cotizaciones registradas para este suplidor" />
        ) : (
          <div className="border border-gray-200 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#1C1C1C' }}>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">No.</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Fecha</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Proyecto</th>
                    <th className="px-4 py-3 text-right font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Total</th>
                    <th className="px-4 py-3 text-right font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Pagado</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quotations.map((q) => {
                    const paid   = q.payments.reduce((s, p) => s + Number(p.amount), 0);
                    const status = QUOTATION_STATUS[q.status] ?? { label: q.status, cls: 'bg-gray-100 text-gray-600' };
                    const total  = q.currency === 'DOP'
                      ? fmtDOP(Number(q.total))
                      : `${q.currency} ${Number(q.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
                    return (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500">
                          COTI-{String(q.number).padStart(3, '0')}
                        </td>
                        <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500 whitespace-nowrap">
                          {fmtDate(q.quotationDate)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-['Space_Mono'] text-xs text-gray-500">{q.project.code}</p>
                          <p className="font-['DM_Sans'] text-xs text-gray-700 leading-tight max-w-[140px] truncate">{q.project.name}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-['Space_Mono'] text-sm font-bold text-gray-900">{total}</td>
                        <td className="px-4 py-3 text-right font-['Space_Mono'] text-sm text-gray-500">
                          {paid > 0 ? fmtDOP(paid) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-['Barlow_Condensed'] uppercase text-xs px-2 py-0.5 ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {quotations.map((q) => {
                const paid   = q.payments.reduce((s, p) => s + Number(p.amount), 0);
                const status = QUOTATION_STATUS[q.status] ?? { label: q.status, cls: 'bg-gray-100 text-gray-600' };
                const total  = q.currency === 'DOP'
                  ? fmtDOP(Number(q.total))
                  : `${q.currency} ${Number(q.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
                return (
                  <div key={q.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-['Space_Mono'] text-xs text-gray-500">COTI-{String(q.number).padStart(3, '0')}</span>
                        <p className="font-['DM_Sans'] text-sm font-semibold text-gray-800 mt-0.5">{q.project.name}</p>
                        <p className="font-['Space_Mono'] text-xs text-gray-400">{q.project.code} · {fmtDate(q.quotationDate)}</p>
                      </div>
                      <span className={`font-['Barlow_Condensed'] uppercase text-xs px-2 py-0.5 shrink-0 ${status.cls}`}>{status.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-['Barlow_Condensed'] text-xs uppercase text-gray-400">Total</span>
                      <span className="font-['Space_Mono'] text-sm font-bold text-gray-900">{total}</span>
                    </div>
                    {paid > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="font-['Barlow_Condensed'] text-xs uppercase text-gray-400">Pagado</span>
                        <span className="font-['Space_Mono'] text-sm text-gray-500">{fmtDOP(paid)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Tab: Órdenes de pago */}
      {activeTab === 'payments' && (
        paymentOrders.length === 0 ? (
          <EmptyState icon={<DollarSign className="w-10 h-10 opacity-20" />} message="No hay órdenes de pago registradas para este suplidor" />
        ) : (
          <div className="border border-gray-200 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#1C1C1C' }}>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">No.</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Tipo</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Concepto</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Proyecto</th>
                    <th className="px-4 py-3 text-right font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Monto</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Estado</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Fecha pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paymentOrders.map((po) => {
                    const status = ORDER_STATUS[po.status] ?? { label: po.status, cls: 'bg-gray-100 text-gray-600' };
                    const amount = po.currency === 'DOP'
                      ? fmtDOP(Number(po.amount))
                      : `${po.currency} ${Number(po.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
                    return (
                      <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500">
                          OP-{String(po.number).padStart(4, '0')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-['Barlow_Condensed'] uppercase text-xs px-2 py-0.5 bg-gray-100 text-gray-700">
                            {po.orderType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-['DM_Sans'] text-gray-800 max-w-[160px] truncate">{po.concept}</td>
                        <td className="px-4 py-3">
                          <p className="font-['Space_Mono'] text-xs text-gray-500">{po.project.code}</p>
                          <p className="font-['DM_Sans'] text-xs text-gray-700 max-w-[120px] truncate">{po.project.name}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-['Space_Mono'] text-sm font-bold text-gray-900">{amount}</td>
                        <td className="px-4 py-3">
                          <span className={`font-['Barlow_Condensed'] uppercase text-xs px-2 py-0.5 ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500 whitespace-nowrap">
                          {po.paidAt ? fmtDate(po.paidAt) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {paymentOrders.map((po) => {
                const status = ORDER_STATUS[po.status] ?? { label: po.status, cls: 'bg-gray-100 text-gray-600' };
                const amount = po.currency === 'DOP'
                  ? fmtDOP(Number(po.amount))
                  : `${po.currency} ${Number(po.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
                return (
                  <div key={po.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-['Space_Mono'] text-xs text-gray-500">OP-{String(po.number).padStart(4, '0')}</span>
                        <p className="font-['DM_Sans'] text-sm font-semibold text-gray-800 mt-0.5 line-clamp-2">{po.concept}</p>
                        <p className="font-['Space_Mono'] text-xs text-gray-400">{po.project.code} · {po.paidAt ? fmtDate(po.paidAt) : '—'}</p>
                      </div>
                      <span className={`font-['Barlow_Condensed'] uppercase text-xs px-2 py-0.5 shrink-0 ${status.cls}`}>{status.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-['Barlow_Condensed'] uppercase text-xs px-2 py-0.5 bg-gray-100 text-gray-700">{po.orderType}</span>
                      <span className="font-['Space_Mono'] text-sm font-bold text-gray-900">{amount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Tab: Comprobantes fiscales */}
      {activeTab === 'vouchers' && (
        fiscalVouchers.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-10 h-10 opacity-20" />}
            message={
              supplier.rnc
                ? 'No hay comprobantes fiscales registrados para este suplidor'
                : 'Este suplidor no tiene RNC registrado — los comprobantes se buscan por RNC'
            }
          />
        ) : (
          <div className="border border-gray-200 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#1C1C1C' }}>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">NCF</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Fecha</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Proyecto</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Descripción</th>
                    <th className="px-4 py-3 text-right font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fiscalVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-700">{v.ncf}</td>
                      <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(v.expense.expenseDate)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-['Space_Mono'] text-xs text-gray-500">{v.expense.project.code}</p>
                        <p className="font-['DM_Sans'] text-xs text-gray-700 max-w-[120px] truncate">{v.expense.project.name}</p>
                      </td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-gray-600 max-w-[200px] truncate">
                        {v.expense.description}
                      </td>
                      <td className="px-4 py-3 text-right font-['Space_Mono'] text-sm font-bold text-gray-900">
                        {fmtDOP(Number(v.expense.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {fiscalVouchers.map((v) => (
                <div key={v.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-['Space_Mono'] text-xs text-gray-700">{v.ncf}</span>
                      <p className="font-['DM_Sans'] text-sm text-gray-700 mt-0.5 line-clamp-2">{v.expense.description}</p>
                      <p className="font-['Space_Mono'] text-xs text-gray-400">{v.expense.project.code} · {fmtDate(v.expense.expenseDate)}</p>
                    </div>
                    <span className="font-['Space_Mono'] text-sm font-bold text-gray-900 shrink-0">{fmtDOP(Number(v.expense.amount))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Tab: Gastos de oficina */}
      {activeTab === 'office' && (
        officeExpenses.length === 0 ? (
          <EmptyState icon={<Sparkles className="w-10 h-10 opacity-20" />} message="No hay gastos de oficina vinculados a este suplidor" />
        ) : (
          <div className="border border-gray-200 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#1C1C1C' }}>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Fecha</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Descripción</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Categoría</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Método</th>
                    <th className="px-4 py-3 text-right font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {officeExpenses.map((oe) => (
                    <tr key={oe.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(oe.expenseDate)}
                      </td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-gray-800 max-w-[180px] truncate">{oe.description}</td>
                      <td className="px-4 py-3 font-['Barlow_Condensed'] uppercase text-xs text-gray-500">
                        {oe.category.replace(/_/g, ' ').toLowerCase()}
                      </td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-xs text-gray-500">
                        {({ CASH: 'Efectivo', TRANSFER: 'Transf.', CARD: 'Tarjeta', CHECK: 'Cheque', OTHER: 'Otro' } as Record<string,string>)[oe.paymentMethod] ?? oe.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-right font-['Space_Mono'] text-sm font-bold text-gray-900">
                        {fmtDOP(Number(oe.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {officeExpenses.map((oe) => (
                <div key={oe.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-['DM_Sans'] text-sm font-semibold text-gray-800 line-clamp-2">{oe.description}</p>
                      <p className="font-['Space_Mono'] text-xs text-gray-400 mt-0.5">{fmtDate(oe.expenseDate)}</p>
                    </div>
                    <span className="font-['Space_Mono'] text-sm font-bold text-gray-900 shrink-0">{fmtDOP(Number(oe.amount))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-['Barlow_Condensed'] uppercase text-xs text-gray-500">
                      {oe.category.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="font-['DM_Sans'] text-xs text-gray-500">
                      {({ CASH: 'Efectivo', TRANSFER: 'Transf.', CARD: 'Tarjeta', CHECK: 'Cheque', OTHER: 'Otro' } as Record<string,string>)[oe.paymentMethod] ?? oe.paymentMethod}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ background: '#1C1C1C' }}>
              <h3 className="font-['Barlow_Condensed'] uppercase tracking-wide text-white">Editar suplidor</h3>
              <button
                onClick={() => { setEditModal(false); setApiError(''); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 text-sm font-['DM_Sans']">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              <div>
                <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                <input className={inputCls} name="name" value={form.name} onChange={handleChange}
                  required minLength={2} maxLength={200} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>RNC</label>
                  <input className={inputCls} name="rnc" value={form.rnc} onChange={handleChange}
                    placeholder="9 u 11 dígitos" maxLength={11} />
                </div>
                <div>
                  <label className={labelCls}>Cédula</label>
                  <input className={inputCls} name="cedula" value={form.cedula} onChange={handleChange}
                    placeholder="000-0000000-0" maxLength={20} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input className={inputCls} name="phone" value={form.phone} onChange={handleChange}
                    placeholder="809-000-0000" maxLength={20} />
                </div>
                <div>
                  <label className={labelCls}>Correo electrónico</label>
                  <input className={inputCls} name="email" type="email" value={form.email}
                    onChange={handleChange} maxLength={150} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Dirección</label>
                <input className={inputCls} name="address" value={form.address} onChange={handleChange}
                  maxLength={500} />
              </div>

              <div>
                <label className={labelCls}>Notas</label>
                <textarea className={inputCls + ' resize-none'} name="notes" value={form.notes}
                  onChange={handleChange} rows={2} maxLength={1000} />
              </div>

              {/* Bank data section */}
              <div className="pt-2">
                <div className="flex items-center gap-2 px-4 py-2.5 mb-3" style={{ background: '#1C1C1C' }}>
                  <CreditCard className="w-3.5 h-3.5 shrink-0" style={{ color: '#F5C218' }} />
                  <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">
                    Datos bancarios
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Banco</label>
                    <input className={inputCls} name="bank" value={form.bank} onChange={handleChange}
                      placeholder="BanReservas, Popular, BHD..." maxLength={100} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Tipo de cuenta</label>
                      <select className={inputCls} name="accountType" value={form.accountType} onChange={handleChange}>
                        <option value="">Seleccionar…</option>
                        {ACCOUNT_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Número de cuenta</label>
                      <input className={inputCls} name="accountNumber" value={form.accountNumber}
                        onChange={handleChange} placeholder="0000000000" maxLength={50} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditModal(false); setApiError(''); }}
                  className="flex-1 py-2.5 border border-gray-300 font-['Barlow_Condensed'] uppercase text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 font-['Barlow_Condensed'] uppercase text-sm font-bold disabled:opacity-50"
                  style={{ background: '#F5C218', color: '#1C1C1C' }}
                >
                  {updateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Guardar cambios</>
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

function StatCard({
  label, value, icon, iconBg, iconColor,
}: {
  label:     string;
  value:     string;
  icon:      React.ReactNode;
  iconBg:    string;
  iconColor: string;
}) {
  return (
    <div className="bg-white p-4 flex items-center gap-3">
      <div
        className="w-8 h-8 flex items-center justify-center shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-['Barlow_Condensed'] uppercase tracking-wide text-xs text-gray-500 leading-tight">{label}</p>
        <p className="font-['Space_Mono'] text-sm font-bold text-gray-900 leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="border border-gray-200 p-12 text-center">
      <div className="flex justify-center mb-3 text-gray-300">{icon}</div>
      <p className="font-['DM_Sans'] text-gray-500 text-sm max-w-sm mx-auto">{message}</p>
    </div>
  );
}
