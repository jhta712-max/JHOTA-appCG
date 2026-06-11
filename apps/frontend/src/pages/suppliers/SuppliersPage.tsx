import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Search, X, AlertCircle, CheckCircle,
  Phone, Mail, Hash, ChevronRight, ToggleLeft, ToggleRight, Pencil,
  CreditCard, Trash2, Star, StarOff,
} from 'lucide-react';
import { suppliersApi } from '../../api';
import { useRole }       from '../../hooks/useRole';
import type { Supplier, SupplierBankAccount } from '../../types';

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'] as const;

type SupplierForm = {
  name: string; rnc: string; cedula: string; phone: string;
  email: string; address: string; notes: string;
};

type BankForm = {
  bank: string; accountType: string; accountNumber: string; currency: string; notes: string; isDefault: boolean;
};

const EMPTY_FORM: SupplierForm = {
  name: '', rnc: '', cedula: '', phone: '', email: '', address: '', notes: '',
};

const EMPTY_BANK: BankForm = {
  bank: '', accountType: 'Cuenta de Ahorros', accountNumber: '', currency: 'RD$', notes: '', isDefault: false,
};

export default function SuppliersPage() {
  const qc   = useQueryClient();
  const role = useRole();

  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal,           setModal]           = useState<'create' | 'edit' | null>(null);
  const [editing,         setEditing]         = useState<Supplier | null>(null);
  const [form,            setForm]            = useState<SupplierForm>(EMPTY_FORM);
  const [apiError,        setApiError]        = useState('');
  const [apiOk,           setApiOk]           = useState('');

  const [showBankForm,    setShowBankForm]    = useState(false);
  const [editingAccount,  setEditingAccount]  = useState<SupplierBankAccount | null>(null);
  const [bankForm,        setBankForm]        = useState<BankForm>(EMPTY_BANK);
  const [bankError,       setBankError]       = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', debouncedSearch],
    queryFn:  () => suppliersApi.list({ search: debouncedSearch || undefined }),
    select:   (r) => r.data.data,
  });

  const { data: bankAccounts, refetch: refetchBanks } = useQuery({
    queryKey: ['supplier-bank-accounts', editing?.id],
    queryFn:  () => suppliersApi.getBankAccounts(editing!.id),
    enabled:  !!editing?.id,
    select:   (r) => r.data.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => suppliersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setApiOk('Suplidor creado exitosamente'); closeModal(); },
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al crear suplidor'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => suppliersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setApiOk('Suplidor actualizado exitosamente'); closeModal(); },
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al actualizar suplidor'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.toggleActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al cambiar estado'),
  });

  const addBankMutation = useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: string; data: unknown }) => suppliersApi.addBankAccount(supplierId, data),
    onSuccess: () => { refetchBanks(); qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowBankForm(false); setEditingAccount(null); setBankForm(EMPTY_BANK); setBankError(''); },
    onError: (e: any) => setBankError(e.response?.data?.error ?? 'Error al agregar cuenta'),
  });

  const updateBankMutation = useMutation({
    mutationFn: ({ supplierId, accountId, data }: { supplierId: string; accountId: string; data: unknown }) => suppliersApi.updateBankAccount(supplierId, accountId, data),
    onSuccess: () => { refetchBanks(); setShowBankForm(false); setEditingAccount(null); setBankForm(EMPTY_BANK); setBankError(''); },
    onError: (e: any) => setBankError(e.response?.data?.error ?? 'Error al actualizar cuenta'),
  });

  const deleteBankMutation = useMutation({
    mutationFn: ({ supplierId, accountId }: { supplierId: string; accountId: string }) => suppliersApi.deleteBankAccount(supplierId, accountId),
    onSuccess: () => { refetchBanks(); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
    onError: (e: any) => setBankError(e.response?.data?.error ?? 'Error al eliminar cuenta'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ supplierId, accountId }: { supplierId: string; accountId: string }) => suppliersApi.setDefaultBankAccount(supplierId, accountId),
    onSuccess: () => refetchBanks(),
    onError: (e: any) => setBankError(e.response?.data?.error ?? 'Error'),
  });

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setApiError('');
    setShowBankForm(false); setEditingAccount(null); setBankForm(EMPTY_BANK); setBankError('');
    setModal('create');
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, rnc: s.rnc ?? '', cedula: s.cedula ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '' });
    setApiError(''); setShowBankForm(false); setEditingAccount(null); setBankForm(EMPTY_BANK); setBankError('');
    setModal('edit');
  }

  function closeModal() {
    setModal(null); setEditing(null); setApiError(''); setForm(EMPTY_FORM);
    setShowBankForm(false); setEditingAccount(null); setBankForm(EMPTY_BANK); setBankError('');
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleBankChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target as any;
    setBankForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? (e.target as any).checked : value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setApiError('');
    const payload = { name: form.name.trim(), rnc: form.rnc.trim() || null, cedula: form.cedula.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null };
    if (!payload.name || payload.name.length < 2) { setApiError('El nombre debe tener al menos 2 caracteres'); return; }
    if (payload.rnc && payload.rnc.length !== 9 && payload.rnc.length !== 11) { setApiError('El RNC debe tener 9 u 11 dígitos'); return; }
    if (modal === 'create') createMutation.mutate(payload);
    else if (editing) updateMutation.mutate({ id: editing.id, data: payload });
  }

  function handleBankSubmit(e: React.FormEvent) {
    e.preventDefault(); setBankError('');
    if (!editing) return;
    if (!bankForm.bank.trim() || bankForm.bank.trim().length < 2) { setBankError('El nombre del banco es obligatorio'); return; }
    if (!bankForm.accountNumber.trim() || bankForm.accountNumber.trim().length < 4) { setBankError('El número de cuenta debe tener al menos 4 caracteres'); return; }
    const data = { bank: bankForm.bank.trim(), accountType: bankForm.accountType, accountNumber: bankForm.accountNumber.trim(), currency: bankForm.currency, notes: bankForm.notes.trim() || null, isDefault: bankForm.isDefault };
    if (editingAccount) updateBankMutation.mutate({ supplierId: editing.id, accountId: editingAccount.id, data });
    else addBankMutation.mutate({ supplierId: editing.id, data });
  }

  function openEditAccount(acc: SupplierBankAccount) {
    setEditingAccount(acc);
    setBankForm({ bank: acc.bank, accountType: acc.accountType, accountNumber: acc.accountNumber, currency: (acc as any).currency ?? 'RD$', notes: acc.notes ?? '', isDefault: acc.isDefault });
    setBankError(''); setShowBankForm(true);
  }

  function cancelBankForm() { setShowBankForm(false); setEditingAccount(null); setBankForm(EMPTY_BANK); setBankError(''); }

  const isPending     = createMutation.isPending || updateMutation.isPending;
  const isBankPending = addBankMutation.isPending || updateBankMutation.isPending;
  const count         = suppliers?.length ?? 0;

  return (
    <div className="space-y-0">

      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 mb-6" style={{ background: '#1C1C1C' }}>
        <div className="max-w-6xl flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-['Barlow_Condensed'] text-xs tracking-[0.2em] uppercase mb-1" style={{ color: '#F5C218' }}>
              MÓDULO / SUPLIDORES
            </p>
            <h1 className="font-['Barlow_Condensed'] text-4xl font-bold tracking-tight text-white uppercase">
              Directorio de Suplidores
            </h1>
            <p className="font-['Space_Mono'] text-sm mt-1" style={{ color: '#F5C218' }}>
              {count} suplidor{count !== 1 ? 'es' : ''} registrado{count !== 1 ? 's' : ''}
            </p>
          </div>
          {role.canManageSuppliers && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide transition-all hover:opacity-90"
              style={{ background: '#F5C218', color: '#1C1C1C' }}
            >
              <Plus className="w-4 h-4" />
              Nuevo Suplidor
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Feedback */}
        {apiOk && (
          <div className="flex items-center gap-2 bg-[#1C1C1C] border border-[#F5C218]/40 text-[#F5C218] p-3 text-sm font-['DM_Sans']">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{apiOk}</span>
            <button onClick={() => setApiOk('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {apiError && !modal && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-800 text-red-400 p-3 text-sm font-['DM_Sans']">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{apiError}</span>
            <button onClick={() => setApiError('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RNC..."
            className="w-full pl-9 pr-9 py-2.5 text-sm font-['DM_Sans'] bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F5C218] focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Building2 className="w-8 h-8 animate-pulse" style={{ color: '#F5C218' }} />
            <p className="font-['DM_Sans'] text-sm text-gray-400">Cargando suplidores...</p>
          </div>
        ) : suppliers && suppliers.length > 0 ? (
          <div className="space-y-2">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className={`bg-white border border-gray-100 p-4 flex items-center gap-4 transition-all hover:border-[#F5C218]/40 hover:shadow-sm ${!s.isActive ? 'opacity-50' : ''}`}
              >
                {/* Avatar */}
                <div
                  className="w-11 h-11 flex items-center justify-center shrink-0 font-['Barlow_Condensed'] text-lg font-bold"
                  style={{ background: s.isActive ? '#1C1C1C' : '#E5E7EB', color: s.isActive ? '#F5C218' : '#9CA3AF' }}
                >
                  {s.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-['Barlow_Condensed'] font-bold text-gray-900 text-base tracking-wide truncate">{s.name}</p>
                    {!s.isActive && (
                      <span className="font-['DM_Sans'] text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {s.rnc && (
                      <span className="font-['Space_Mono'] text-xs text-gray-500 flex items-center gap-1">
                        <Hash className="w-3 h-3" />{s.rnc}
                      </span>
                    )}
                    {s.phone && (
                      <span className="font-['DM_Sans'] text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{s.phone}
                      </span>
                    )}
                    {s.email && (
                      <span className="font-['DM_Sans'] text-xs text-gray-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" />{s.email}
                      </span>
                    )}
                    {(s.bankAccounts?.length ?? 0) > 0 ? (
                      <span className="font-['DM_Sans'] text-xs text-emerald-600 flex items-center gap-1 font-medium">
                        <CreditCard className="w-3 h-3" />
                        {s.bankAccounts!.length} cuenta{s.bankAccounts!.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="font-['DM_Sans'] text-xs text-orange-500 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />Sin cuentas
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {role.canManageSuppliers && (
                    <>
                      <button onClick={() => openEdit(s)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Editar suplidor">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleMutation.mutate(s.id)}
                        className={`p-1.5 transition-colors ${s.isActive ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                        title={s.isActive ? 'Desactivar' : 'Activar'}>
                        {s.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </>
                  )}
                  <Link
                    to={`/suppliers/${s.id}`}
                    className="font-['Barlow_Condensed'] flex items-center gap-1 text-xs font-semibold uppercase tracking-wide px-3 py-1.5 border transition-all hover:border-[#F5C218] hover:text-[#1C1C1C]"
                    style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                  >
                    Historial
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 p-14 text-center">
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4" style={{ background: '#1C1C1C' }}>
              <Building2 className="w-7 h-7" style={{ color: '#F5C218' }} />
            </div>
            <p className="font-['Barlow_Condensed'] text-lg font-bold text-gray-700 uppercase tracking-wide">
              {debouncedSearch ? 'Sin resultados' : 'Sin suplidores'}
            </p>
            <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1">
              {debouncedSearch ? 'No se encontraron suplidores con ese criterio' : 'No hay suplidores registrados aún'}
            </p>
            {!debouncedSearch && role.canManageSuppliers && (
              <button
                onClick={openCreate}
                className="mt-5 px-4 py-2.5 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide transition-all hover:opacity-90"
                style={{ background: '#F5C218', color: '#1C1C1C' }}
              >
                Registrar primer suplidor
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Modal crear/editar ────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0" style={{ background: '#1C1C1C' }}>
              <h3 className="font-['Barlow_Condensed'] text-xl font-bold text-white uppercase tracking-wide">
                {modal === 'create' ? 'Nuevo Suplidor' : `Editar: ${editing?.name}`}
              </h3>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {apiError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 text-sm font-['DM_Sans']">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{apiError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218] focus:border-transparent"
                    name="name" value={form.name} onChange={handleChange}
                    placeholder="Ej: Ferretería La Central, S.R.L." required minLength={2} maxLength={200}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">RNC</label>
                    <input className="w-full font-['Space_Mono'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="rnc" value={form.rnc} onChange={handleChange} placeholder="9 u 11 dígitos" maxLength={11} />
                    <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">Empresa / contribuyente</p>
                  </div>
                  <div>
                    <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Cédula</label>
                    <input className="w-full font-['Space_Mono'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="cedula" value={form.cedula} onChange={handleChange} placeholder="001-0000000-0" maxLength={20} />
                    <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">Persona física</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Teléfono</label>
                    <input className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="phone" value={form.phone} onChange={handleChange} placeholder="809-000-0000" maxLength={20} />
                  </div>
                  <div>
                    <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Email</label>
                    <input className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="email" type="email" value={form.email} onChange={handleChange} placeholder="contacto@empresa.com" maxLength={150} />
                  </div>
                </div>

                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Dirección</label>
                  <input className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="address" value={form.address} onChange={handleChange} placeholder="Calle, sector, ciudad" maxLength={500} />
                </div>

                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Notas</label>
                  <textarea className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218] resize-none" name="notes" value={form.notes} onChange={handleChange} placeholder="Información adicional..." rows={2} maxLength={1000} />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide py-2.5 border-2 border-gray-200 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isPending}
                    className="flex-1 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide py-2.5 flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#F5C218', color: '#1C1C1C' }}>
                    {isPending ? <span className="w-4 h-4 border-2 border-[#1C1C1C] border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {modal === 'create' ? 'Crear Suplidor' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>

              {/* Bank accounts section */}
              {modal === 'edit' && editing && role.canManageSuppliers && (
                <div className="border-t border-gray-100 px-6 pb-6 pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide text-gray-700 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        Cuentas Bancarias
                      </p>
                      <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">Para órdenes de pago por transferencia</p>
                    </div>
                    {!showBankForm && (
                      <button
                        onClick={() => { setShowBankForm(true); setEditingAccount(null); setBankForm(EMPTY_BANK); }}
                        className="flex items-center gap-1.5 font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-wide px-3 py-1.5 border-2 transition-colors"
                        style={{ borderColor: '#F5C218', color: '#1C1C1C' }}>
                        <Plus className="w-3.5 h-3.5" />Agregar
                      </button>
                    )}
                  </div>

                  {bankAccounts && bankAccounts.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {bankAccounts.map((acc) => (
                        <div key={acc.id} className={`flex items-center gap-3 p-3 border transition-colors ${acc.isDefault ? 'border-[#F5C218]/40 bg-[#F5C218]/5' : 'border-gray-100 bg-gray-50'}`}>
                          <CreditCard className={`w-4 h-4 shrink-0 ${acc.isDefault ? 'text-[#F5C218]' : 'text-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-['Barlow_Condensed'] text-sm font-bold text-gray-800 uppercase">{acc.bank}</span>
                              {acc.isDefault && (
                                <span className="font-['DM_Sans'] text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#F5C218', color: '#1C1C1C' }}>
                                  Predeterminada
                                </span>
                              )}
                            </div>
                            <p className="font-['Space_Mono'] text-xs text-gray-500 mt-0.5">
                              {acc.accountType} · {acc.accountNumber}
                              {(acc as any).currency && (acc as any).currency !== 'RD$' && (
                                <span className={`ml-2 font-semibold ${(acc as any).currency === 'US$' ? 'text-emerald-600' : 'text-purple-600'}`}>
                                  {(acc as any).currency}
                                </span>
                              )}
                            </p>
                            {acc.notes && <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">{acc.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!acc.isDefault && (
                              <button onClick={() => setDefaultMutation.mutate({ supplierId: editing.id, accountId: acc.id })}
                                className="p-1.5 text-gray-400 hover:text-[#F5C218] hover:bg-[#F5C218]/10 transition-colors" title="Predeterminada">
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {acc.isDefault && <span className="p-1.5 text-[#F5C218]"><StarOff className="w-3.5 h-3.5" /></span>}
                            <button onClick={() => openEditAccount(acc)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            {bankAccounts.length > 1 && (
                              <button onClick={() => { if (confirm('¿Eliminar esta cuenta bancaria?')) deleteBankMutation.mutate({ supplierId: editing.id, accountId: acc.id }); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !showBankForm ? (
                    <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 mb-4">
                      <CreditCard className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                      <p className="font-['DM_Sans'] text-sm text-gray-400">Sin cuentas bancarias</p>
                    </div>
                  ) : null}

                  {showBankForm && (
                    <form onSubmit={handleBankSubmit} className="bg-gray-50 border border-gray-200 p-4 space-y-3">
                      <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-widest text-gray-600">
                        {editingAccount ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}
                      </p>
                      {bankError && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 p-2 text-xs font-['DM_Sans']">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{bankError}
                        </div>
                      )}
                      <div>
                        <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wide text-gray-500 mb-1">Banco <span className="text-red-500">*</span></label>
                        <input className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="bank" value={bankForm.bank} onChange={handleBankChange} placeholder="Banreservas, Banco Popular, BHD…" maxLength={100} required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wide text-gray-500 mb-1">Tipo</label>
                          <select className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="accountType" value={bankForm.accountType} onChange={handleBankChange}>
                            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wide text-gray-500 mb-1">No. de cuenta <span className="text-red-500">*</span></label>
                          <input className="w-full font-['Space_Mono'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="accountNumber" value={bankForm.accountNumber} onChange={handleBankChange} placeholder="000-000000-0" maxLength={50} required />
                        </div>
                      </div>
                      <div>
                        <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wide text-gray-500 mb-1.5">Divisa</label>
                        <div className="flex items-center gap-2">
                          {(['RD$', 'US$', '€'] as const).map((cur) => (
                            <label key={cur} className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 border font-['Space_Mono'] text-sm font-medium transition-colors ${bankForm.currency === cur ? 'border-[#F5C218] bg-[#F5C218]/10 text-[#1C1C1C]' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                              <input type="radio" name="currency" value={cur} checked={bankForm.currency === cur} onChange={handleBankChange} className="sr-only" />
                              {cur}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wide text-gray-500 mb-1">Notas</label>
                        <input className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]" name="notes" value={bankForm.notes} onChange={handleBankChange} placeholder="Opcional…" maxLength={200} />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer font-['DM_Sans'] text-xs text-gray-600">
                        <input type="checkbox" name="isDefault" checked={bankForm.isDefault} onChange={handleBankChange} className="rounded accent-[#F5C218]" />
                        Establecer como cuenta predeterminada
                      </label>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={cancelBankForm} className="flex-1 font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-wide py-2 border-2 border-gray-200 hover:bg-gray-100 transition-colors">
                          Cancelar
                        </button>
                        <button type="submit" disabled={isBankPending}
                          className="flex-1 font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-wide py-2 flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ background: '#F5C218', color: '#1C1C1C' }}>
                          {isBankPending ? <span className="w-3.5 h-3.5 border-2 border-[#1C1C1C] border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          {editingAccount ? 'Guardar' : 'Agregar'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
