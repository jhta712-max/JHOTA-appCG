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

// ── Componente principal ──────────────────────────────────────
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

  // Bank accounts state
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

  // Bank accounts for the supplier being edited
  const { data: bankAccounts, refetch: refetchBanks } = useQuery({
    queryKey: ['supplier-bank-accounts', editing?.id],
    queryFn:  () => suppliersApi.getBankAccounts(editing!.id),
    enabled:  !!editing?.id,
    select:   (r) => r.data.data,
  });

  // ── Supplier mutations ────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: unknown) => suppliersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setApiOk('Suplidor creado exitosamente');
      closeModal();
    },
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al crear suplidor'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => suppliersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setApiOk('Suplidor actualizado exitosamente');
      closeModal();
    },
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al actualizar suplidor'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.toggleActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al cambiar estado'),
  });

  // ── Bank account mutations ────────────────────────────────────
  const addBankMutation = useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: string; data: unknown }) =>
      suppliersApi.addBankAccount(supplierId, data),
    onSuccess: () => {
      refetchBanks();
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setShowBankForm(false);
      setEditingAccount(null);
      setBankForm(EMPTY_BANK);
      setBankError('');
    },
    onError: (e: any) => setBankError(e.response?.data?.error ?? 'Error al agregar cuenta'),
  });

  const updateBankMutation = useMutation({
    mutationFn: ({ supplierId, accountId, data }: { supplierId: string; accountId: string; data: unknown }) =>
      suppliersApi.updateBankAccount(supplierId, accountId, data),
    onSuccess: () => {
      refetchBanks();
      setShowBankForm(false);
      setEditingAccount(null);
      setBankForm(EMPTY_BANK);
      setBankError('');
    },
    onError: (e: any) => setBankError(e.response?.data?.error ?? 'Error al actualizar cuenta'),
  });

  const deleteBankMutation = useMutation({
    mutationFn: ({ supplierId, accountId }: { supplierId: string; accountId: string }) =>
      suppliersApi.deleteBankAccount(supplierId, accountId),
    onSuccess: () => {
      refetchBanks();
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: any) => setBankError(e.response?.data?.error ?? 'Error al eliminar cuenta'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ supplierId, accountId }: { supplierId: string; accountId: string }) =>
      suppliersApi.setDefaultBankAccount(supplierId, accountId),
    onSuccess: () => refetchBanks(),
    onError: (e: any) => setBankError(e.response?.data?.error ?? 'Error'),
  });

  // ── Handlers ──────────────────────────────────────────────────
  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setApiError('');
    setShowBankForm(false);
    setEditingAccount(null);
    setBankForm(EMPTY_BANK);
    setBankError('');
    setModal('create');
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name:    s.name,
      rnc:     s.rnc     ?? '',
      cedula:  s.cedula  ?? '',
      phone:   s.phone   ?? '',
      email:   s.email   ?? '',
      address: s.address ?? '',
      notes:   s.notes   ?? '',
    });
    setApiError('');
    setShowBankForm(false);
    setEditingAccount(null);
    setBankForm(EMPTY_BANK);
    setBankError('');
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setApiError('');
    setForm(EMPTY_FORM);
    setShowBankForm(false);
    setEditingAccount(null);
    setBankForm(EMPTY_BANK);
    setBankError('');
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
    e.preventDefault();
    setApiError('');
    const payload = {
      name:    form.name.trim(),
      rnc:     form.rnc.trim()     || null,
      cedula:  form.cedula.trim()  || null,
      phone:   form.phone.trim()   || null,
      email:   form.email.trim()   || null,
      address: form.address.trim() || null,
      notes:   form.notes.trim()   || null,
    };
    if (!payload.name || payload.name.length < 2) {
      setApiError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    if (payload.rnc && payload.rnc.length !== 9 && payload.rnc.length !== 11) {
      setApiError('El RNC debe tener 9 u 11 dígitos');
      return;
    }
    if (modal === 'create') {
      createMutation.mutate(payload);
    } else if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    }
  }

  function handleBankSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBankError('');
    if (!editing) return;
    if (!bankForm.bank.trim() || bankForm.bank.trim().length < 2) {
      setBankError('El nombre del banco es obligatorio');
      return;
    }
    if (!bankForm.accountNumber.trim() || bankForm.accountNumber.trim().length < 4) {
      setBankError('El número de cuenta debe tener al menos 4 caracteres');
      return;
    }
    const data = {
      bank:          bankForm.bank.trim(),
      accountType:   bankForm.accountType,
      accountNumber: bankForm.accountNumber.trim(),
      currency:      bankForm.currency,
      notes:         bankForm.notes.trim() || null,
      isDefault:     bankForm.isDefault,
    };
    if (editingAccount) {
      updateBankMutation.mutate({ supplierId: editing.id, accountId: editingAccount.id, data });
    } else {
      addBankMutation.mutate({ supplierId: editing.id, data });
    }
  }

  function openEditAccount(acc: SupplierBankAccount) {
    setEditingAccount(acc);
    setBankForm({
      bank:          acc.bank,
      accountType:   acc.accountType,
      accountNumber: acc.accountNumber,
      currency:      (acc as any).currency ?? 'RD$',
      notes:         acc.notes ?? '',
      isDefault:     acc.isDefault,
    });
    setBankError('');
    setShowBankForm(true);
  }

  function cancelBankForm() {
    setShowBankForm(false);
    setEditingAccount(null);
    setBankForm(EMPTY_BANK);
    setBankError('');
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isBankPending = addBankMutation.isPending || updateBankMutation.isPending;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-0">

      {/* Hero band */}
      <div style={{ background: '#1C1C1C' }} className="px-6 py-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-400 mb-0.5">
            MÓDULO / SUPLIDORES
          </p>
          <h1 className="font-['Barlow_Condensed'] uppercase tracking-widest text-2xl font-bold text-white leading-tight">
            Directorio de Suplidores
          </h1>
          <p className="font-['DM_Sans'] text-sm text-gray-400 mt-0.5">
            {suppliers?.length ?? 0} suplidor{(suppliers?.length ?? 0) !== 1 ? 'es' : ''} registrado{(suppliers?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        {role.canManageSuppliers && (
          <button
            onClick={openCreate}
            style={{ background: '#F5C218', color: '#1C1C1C' }}
            className="font-['Barlow_Condensed'] uppercase font-bold tracking-widest text-sm px-4 py-2 flex items-center gap-2 transition-opacity hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Nuevo Suplidor
          </button>
        )}
      </div>

      <div className="p-6 space-y-5">

        {/* Feedback */}
        {apiOk && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 p-3 text-sm font-['DM_Sans']">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{apiOk}</span>
            <button onClick={() => setApiOk('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {apiError && !modal && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 text-sm font-['DM_Sans']">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{apiError}</span>
            <button onClick={() => setApiError('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RNC..."
            className="border border-gray-300 rounded-none px-3 py-2 pl-9 w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 font-['DM_Sans']">
            <Building2 className="w-8 h-8 mx-auto mb-3 opacity-30 animate-pulse" />
            Cargando suplidores...
          </div>
        ) : suppliers && suppliers.length > 0 ? (
          <div className="border border-gray-200 overflow-hidden">
            {/* Table header */}
            <div
              style={{ background: '#1C1C1C' }}
              className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-4 py-2 font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white"
            >
              <span>Suplidor / Contacto</span>
              <span>RNC / Cédula</span>
              <span>Cuentas</span>
              <span>Acciones</span>
            </div>
            {suppliers.map((s, idx) => (
              <div
                key={s.id}
                className={`grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center border-b border-gray-100 transition-colors hover:bg-gray-50 ${!s.isActive ? 'opacity-60' : ''} ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
              >
                {/* Name + contact */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className="w-7 h-7 flex items-center justify-center shrink-0"
                      style={{ background: s.isActive ? '#F5C218' : '#E5E7EB' }}
                    >
                      <Building2 className="w-4 h-4 text-gray-900" />
                    </div>
                    <p className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wide text-gray-900 text-sm truncate">{s.name}</p>
                    {!s.isActive && (
                      <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs bg-gray-200 text-gray-500 px-2 py-0.5 font-semibold">Inactivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap pl-9">
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
                  </div>
                </div>

                {/* RNC / Cedula */}
                <div>
                  {s.rnc && (
                    <span className="font-['Space_Mono'] text-xs text-gray-700 flex items-center gap-1">
                      <Hash className="w-3 h-3 text-gray-400" />{s.rnc}
                    </span>
                  )}
                  {s.cedula && (
                    <span className="font-['Space_Mono'] text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      {s.cedula}
                    </span>
                  )}
                  {!s.rnc && !s.cedula && (
                    <span className="font-['DM_Sans'] text-xs text-gray-400 italic">Sin identificación</span>
                  )}
                </div>

                {/* Bank accounts */}
                <div>
                  {(s.bankAccounts?.length ?? 0) > 0 ? (
                    <span className="font-['DM_Sans'] text-xs text-blue-700 flex items-center gap-1 font-medium">
                      <CreditCard className="w-3 h-3" />
                      {s.bankAccounts!.length} cuenta{s.bankAccounts!.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="font-['DM_Sans'] text-xs text-orange-500 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />Sin cuentas
                    </span>
                  )}
                </div>

                {/* Actions */}
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
                        className={`p-1.5 transition-colors ${
                          s.isActive ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        title={s.isActive ? 'Desactivar' : 'Activar'}>
                        {s.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </>
                  )}
                  <Link
                    to={`/suppliers/${s.id}`}
                    className="font-['Barlow_Condensed'] uppercase tracking-wide flex items-center gap-1 text-xs font-semibold px-2 py-1.5 transition-colors"
                    style={{ color: '#F5C218' }}
                  >
                    Historial
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-gray-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="font-['DM_Sans'] text-gray-500 font-medium">
              {debouncedSearch ? 'No se encontraron suplidores con ese criterio' : 'No hay suplidores registrados'}
            </p>
            {!debouncedSearch && role.canManageSuppliers && (
              <button
                onClick={openCreate}
                style={{ background: '#F5C218', color: '#1C1C1C' }}
                className="font-['Barlow_Condensed'] uppercase font-bold tracking-widest text-sm mt-4 px-4 py-2 inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                Registrar primer suplidor
              </button>
            )}
          </div>
        )}

      </div>

      {/* ── Modal crear/editar ────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div style={{ background: '#1C1C1C' }} className="flex items-center justify-between px-6 py-4 shrink-0">
              <h3 className="font-['Barlow_Condensed'] uppercase tracking-widest text-white font-bold text-base">
                {modal === 'create' ? 'Nuevo Suplidor' : `Editar: ${editing?.name}`}
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* ── Info básica ── */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {apiError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 text-sm font-['DM_Sans']">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{apiError}</span>
                  </div>
                )}

                <div>
                  <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm"
                    name="name" value={form.name} onChange={handleChange}
                    placeholder="Ej: Ferretería La Central, S.R.L." required minLength={2} maxLength={200}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">RNC</label>
                    <input
                      className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['Space_Mono'] text-sm"
                      name="rnc" value={form.rnc} onChange={handleChange}
                      placeholder="9 u 11 dígitos" maxLength={11}
                    />
                    <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">Empresa / contribuyente</p>
                  </div>
                  <div>
                    <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">Cédula</label>
                    <input
                      className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['Space_Mono'] text-sm"
                      name="cedula" value={form.cedula} onChange={handleChange}
                      placeholder="001-0000000-0" maxLength={20}
                    />
                    <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">Persona física</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">Teléfono</label>
                    <input
                      className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm"
                      name="phone" value={form.phone} onChange={handleChange}
                      placeholder="809-000-0000" maxLength={20}
                    />
                  </div>
                  <div>
                    <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">Correo electrónico</label>
                    <input
                      className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm"
                      name="email" type="email" value={form.email} onChange={handleChange}
                      placeholder="contacto@empresa.com" maxLength={150}
                    />
                  </div>
                </div>

                <div>
                  <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">Dirección</label>
                  <input
                    className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm"
                    name="address" value={form.address} onChange={handleChange}
                    placeholder="Calle, sector, ciudad" maxLength={500}
                  />
                </div>

                <div>
                  <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">Notas</label>
                  <textarea
                    className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm resize-none"
                    name="notes" value={form.notes} onChange={handleChange}
                    placeholder="Información adicional..." rows={2} maxLength={1000}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-['Barlow_Condensed'] uppercase tracking-widest text-sm px-4 py-2 flex-1 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    style={{ background: '#F5C218', color: '#1C1C1C' }}
                    className="font-['Barlow_Condensed'] uppercase font-bold tracking-widest text-sm px-4 py-2 flex-1 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {isPending ? (
                      <><span className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />Guardando...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" />{modal === 'create' ? 'Crear Suplidor' : 'Guardar Cambios'}</>
                    )}
                  </button>
                </div>
              </form>

              {/* ── Cuentas bancarias (solo en edición) ── */}
              {modal === 'edit' && editing && role.canManageSuppliers && (
                <div className="border-t border-gray-200 px-6 pb-6 pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs font-semibold text-gray-700 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        Cuentas Bancarias
                      </p>
                      <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">Para generar órdenes de pago por transferencia</p>
                    </div>
                    {!showBankForm && (
                      <button
                        onClick={() => { setShowBankForm(true); setEditingAccount(null); setBankForm(EMPTY_BANK); }}
                        style={{ background: '#F5C218', color: '#1C1C1C' }}
                        className="font-['Barlow_Condensed'] uppercase font-bold tracking-widest text-xs px-3 py-1.5 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar
                      </button>
                    )}
                  </div>

                  {/* Lista de cuentas */}
                  {bankAccounts && bankAccounts.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {bankAccounts.map((acc) => (
                        <div key={acc.id} className={`flex items-center gap-3 p-3 border transition-colors ${
                          acc.isDefault ? 'border-l-4 border-[#F5C218] bg-amber-50' : 'border-gray-200 bg-gray-50'
                        }`}>
                          <CreditCard className={`w-4 h-4 shrink-0 ${acc.isDefault ? 'text-amber-500' : 'text-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-['Barlow_Condensed'] uppercase tracking-wide text-sm font-semibold text-gray-800">{acc.bank}</span>
                              {acc.isDefault && (
                                <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs bg-amber-200 text-amber-800 px-2 py-0.5 font-bold">
                                  Predeterminada
                                </span>
                              )}
                            </div>
                            <p className="font-['DM_Sans'] text-xs text-gray-500 mt-0.5">
                              {acc.accountType} · <span className="font-['Space_Mono']">{acc.accountNumber}</span>
                              {(acc as any).currency && (acc as any).currency !== 'RD$' && (
                                <span className={`ml-2 font-['Space_Mono'] font-semibold ${(acc as any).currency === 'US$' ? 'text-green-600' : 'text-purple-600'}`}>
                                  {(acc as any).currency}
                                </span>
                              )}
                            </p>
                            {acc.notes && <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">{acc.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!acc.isDefault && (
                              <button
                                onClick={() => setDefaultMutation.mutate({ supplierId: editing.id, accountId: acc.id })}
                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                title="Establecer como predeterminada">
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {acc.isDefault && (
                              <span className="p-1.5 text-amber-500" title="Cuenta predeterminada">
                                <StarOff className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <button
                              onClick={() => openEditAccount(acc)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                              title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {bankAccounts.length > 1 && (
                              <button
                                onClick={() => { if (confirm('¿Eliminar esta cuenta bancaria?')) deleteBankMutation.mutate({ supplierId: editing.id, accountId: acc.id }); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Eliminar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !showBankForm ? (
                    <div className="border-l-4 border-[#F5C218] bg-amber-50 p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <CreditCard className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-['Barlow_Condensed'] uppercase tracking-wide text-sm font-semibold text-amber-800">Sin cuentas bancarias</p>
                          <p className="font-['DM_Sans'] text-xs text-amber-700 mt-0.5">Agrega al menos una para poder generar órdenes de pago</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Formulario para agregar/editar cuenta */}
                  {showBankForm && (
                    <form onSubmit={handleBankSubmit} className="bg-gray-50 border border-gray-200 p-4 space-y-3">
                      <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs font-bold text-gray-700">
                        {editingAccount ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}
                      </p>

                      {bankError && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 p-2 text-xs font-['DM_Sans']">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{bankError}
                        </div>
                      )}

                      <div>
                        <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">
                          Banco <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm"
                          name="bank" value={bankForm.bank} onChange={handleBankChange}
                          placeholder="Ej: Banreservas, Banco Popular, BHD…" maxLength={100} required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">Tipo de cuenta</label>
                          <select
                            className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm"
                            name="accountType" value={bankForm.accountType} onChange={handleBankChange}
                          >
                            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">
                            Núm. de cuenta <span className="text-red-500">*</span>
                          </label>
                          <input
                            className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['Space_Mono'] text-sm"
                            name="accountNumber" value={bankForm.accountNumber}
                            onChange={handleBankChange} placeholder="000-000000-0" maxLength={50} required
                          />
                        </div>
                      </div>

                      {/* Divisa */}
                      <div>
                        <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">Divisa</label>
                        <div className="flex items-center gap-2 mt-1">
                          {(['RD$', 'US$', '€'] as const).map((cur) => (
                            <label key={cur} className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 border text-sm font-medium transition-colors font-['Space_Mono'] ${
                              bankForm.currency === cur
                                ? cur === 'RD$' ? 'border-blue-400 bg-blue-50 text-blue-700'
                                  : cur === 'US$' ? 'border-green-400 bg-green-50 text-green-700'
                                  : 'border-purple-400 bg-purple-50 text-purple-700'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                            }`}>
                              <input
                                type="radio"
                                name="currency"
                                value={cur}
                                checked={bankForm.currency === cur}
                                onChange={handleBankChange}
                                className="sr-only"
                              />
                              {cur}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 block mb-1">Notas (opcional)</label>
                        <input
                          className="border border-gray-300 rounded-none px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#F5C218] font-['DM_Sans'] text-sm"
                          name="notes" value={bankForm.notes} onChange={handleBankChange}
                          placeholder="Ej: Cuenta en USD, para pagos de servicios…" maxLength={200}
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="isDefault" checked={bankForm.isDefault}
                          onChange={handleBankChange} className="rounded" />
                        <span className="font-['DM_Sans'] text-xs text-gray-600">Establecer como cuenta predeterminada</span>
                      </label>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={cancelBankForm}
                          className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-['Barlow_Condensed'] uppercase tracking-widest text-xs py-1.5 flex-1 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isBankPending}
                          style={{ background: '#F5C218', color: '#1C1C1C' }}
                          className="font-['Barlow_Condensed'] uppercase font-bold tracking-widest text-xs py-1.5 flex-1 flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-60"
                        >
                          {isBankPending ? (
                            <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          {editingAccount ? 'Guardar Cambios' : 'Agregar Cuenta'}
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
