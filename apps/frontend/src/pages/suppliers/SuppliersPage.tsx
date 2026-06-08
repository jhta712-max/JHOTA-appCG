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
  bank: string; accountType: string; accountNumber: string; notes: string; isDefault: boolean;
};

const EMPTY_FORM: SupplierForm = {
  name: '', rnc: '', cedula: '', phone: '', email: '', address: '', notes: '',
};

const EMPTY_BANK: BankForm = {
  bank: '', accountType: 'Cuenta de Ahorros', accountNumber: '', notes: '', isDefault: false,
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
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="module-label">MÓDULO / SUPLIDORES</p>
          <h1 className="page-title">Directorio de Suplidores</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {suppliers?.length ?? 0} suplidor{(suppliers?.length ?? 0) !== 1 ? 'es' : ''} registrado{(suppliers?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        {role.canManageSuppliers && (
          <button onClick={openCreate} className="smi-btn">
            <Plus className="w-4 h-4" />
            Nuevo Suplidor
          </button>
        )}
      </div>

      {/* Feedback */}
      {apiOk && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{apiOk}</span>
          <button onClick={() => setApiOk('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {apiError && !modal && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
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
          className="input-field pl-9 w-full max-w-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-8 h-8 mx-auto mb-3 opacity-30 animate-pulse" />
          Cargando suplidores...
        </div>
      ) : suppliers && suppliers.length > 0 ? (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.id} className={`card p-4 flex items-center gap-4 transition-all ${!s.isActive ? 'opacity-60' : ''}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: s.isActive ? '#F5C218' : '#E5E7EB' }}>
                <Building2 className="w-5 h-5 text-gray-900" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm truncate">{s.name}</p>
                  {!s.isActive && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inactivo</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {s.rnc && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="w-3 h-3" />RNC: {s.rnc}
                    </span>
                  )}
                  {s.phone && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />{s.phone}
                    </span>
                  )}
                  {s.email && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />{s.email}
                    </span>
                  )}
                  {/* Bank accounts count */}
                  {(s.bankAccounts?.length ?? 0) > 0 ? (
                    <span className="text-xs text-blue-600 flex items-center gap-1 font-medium">
                      <CreditCard className="w-3 h-3" />
                      {s.bankAccounts!.length} cuenta{s.bankAccounts!.length !== 1 ? 's' : ''} bancaria{s.bankAccounts!.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-orange-500 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />Sin cuentas bancarias
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {role.canManageSuppliers && (
                  <>
                    <button onClick={() => openEdit(s)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar suplidor">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate(s.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        s.isActive ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title={s.isActive ? 'Desactivar' : 'Activar'}>
                      {s.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </>
                )}
                <Link
                  to={`/suppliers/${s.id}`}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                  Ver historial
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {debouncedSearch ? 'No se encontraron suplidores con ese criterio' : 'No hay suplidores registrados'}
          </p>
          {!debouncedSearch && role.canManageSuppliers && (
            <button onClick={openCreate} className="btn-primary mt-4 text-sm">
              Registrar primer suplidor
            </button>
          )}
        </div>
      )}

      {/* ── Modal crear/editar ────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-900">
                {modal === 'create' ? 'Nuevo suplidor' : `Editar: ${editing?.name}`}
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* ── Info básica ── */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {apiError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{apiError}</span>
                  </div>
                )}

                <div>
                  <label className="label">Nombre <span className="text-red-500">*</span></label>
                  <input className="input-field" name="name" value={form.name} onChange={handleChange}
                    placeholder="Ej: Ferretería La Central, S.R.L." required minLength={2} maxLength={200} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">RNC</label>
                    <input className="input-field" name="rnc" value={form.rnc} onChange={handleChange}
                      placeholder="9 u 11 dígitos" maxLength={11} />
                    <p className="text-xs text-gray-400 mt-1">Empresa / contribuyente</p>
                  </div>
                  <div>
                    <label className="label">Cédula</label>
                    <input className="input-field" name="cedula" value={form.cedula} onChange={handleChange}
                      placeholder="001-0000000-0" maxLength={20} />
                    <p className="text-xs text-gray-400 mt-1">Persona física</p>
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
                    <input className="input-field" name="email" type="email" value={form.email} onChange={handleChange}
                      placeholder="contacto@empresa.com" maxLength={150} />
                  </div>
                </div>

                <div>
                  <label className="label">Dirección</label>
                  <input className="input-field" name="address" value={form.address} onChange={handleChange}
                    placeholder="Calle, sector, ciudad" maxLength={500} />
                </div>

                <div>
                  <label className="label">Notas</label>
                  <textarea className="input-field resize-none" name="notes" value={form.notes} onChange={handleChange}
                    placeholder="Información adicional..." rows={2} maxLength={1000} />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" disabled={isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {isPending ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" />{modal === 'create' ? 'Crear suplidor' : 'Guardar cambios'}</>
                    )}
                  </button>
                </div>
              </form>

              {/* ── Cuentas bancarias (solo en edición) ── */}
              {modal === 'edit' && editing && role.canManageSuppliers && (
                <div className="border-t border-gray-100 px-6 pb-6 pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        Cuentas Bancarias
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Para generar órdenes de pago por transferencia</p>
                    </div>
                    {!showBankForm && (
                      <button
                        onClick={() => { setShowBankForm(true); setEditingAccount(null); setBankForm(EMPTY_BANK); }}
                        className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                        Agregar cuenta
                      </button>
                    )}
                  </div>

                  {/* Lista de cuentas */}
                  {bankAccounts && bankAccounts.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {bankAccounts.map((acc) => (
                        <div key={acc.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          acc.isDefault ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'
                        }`}>
                          <CreditCard className={`w-4 h-4 shrink-0 ${acc.isDefault ? 'text-amber-500' : 'text-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800">{acc.bank}</span>
                              {acc.isDefault && (
                                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                                  Predeterminada
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {acc.accountType} · <span className="font-mono">{acc.accountNumber}</span>
                            </p>
                            {acc.notes && <p className="text-xs text-gray-400 mt-0.5">{acc.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!acc.isDefault && (
                              <button
                                onClick={() => setDefaultMutation.mutate({ supplierId: editing.id, accountId: acc.id })}
                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
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
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {bankAccounts.length > 1 && (
                              <button
                                onClick={() => { if (confirm('¿Eliminar esta cuenta bancaria?')) deleteBankMutation.mutate({ supplierId: editing.id, accountId: acc.id }); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !showBankForm ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 mb-4">
                      <CreditCard className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Sin cuentas bancarias registradas</p>
                      <p className="text-xs text-gray-400 mt-1">Agrega al menos una para poder generar órdenes de pago</p>
                    </div>
                  ) : null}

                  {/* Formulario para agregar/editar cuenta */}
                  {showBankForm && (
                    <form onSubmit={handleBankSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {editingAccount ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'}
                      </p>

                      {bankError && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg p-2 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{bankError}
                        </div>
                      )}

                      <div>
                        <label className="label text-xs">Banco <span className="text-red-500">*</span></label>
                        <input className="input-field text-sm" name="bank" value={bankForm.bank} onChange={handleBankChange}
                          placeholder="Ej: Banreservas, Banco Popular, BHD…" maxLength={100} required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">Tipo de cuenta</label>
                          <select className="input-field text-sm" name="accountType" value={bankForm.accountType} onChange={handleBankChange}>
                            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs">Número de cuenta <span className="text-red-500">*</span></label>
                          <input className="input-field font-mono text-sm" name="accountNumber" value={bankForm.accountNumber}
                            onChange={handleBankChange} placeholder="000-000000-0" maxLength={50} required />
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs">Notas (opcional)</label>
                        <input className="input-field text-sm" name="notes" value={bankForm.notes} onChange={handleBankChange}
                          placeholder="Ej: Cuenta en USD, para pagos de servicios…" maxLength={200} />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="isDefault" checked={bankForm.isDefault}
                          onChange={handleBankChange} className="rounded" />
                        <span className="text-xs text-gray-600">Establecer como cuenta predeterminada</span>
                      </label>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={cancelBankForm} className="btn-secondary text-xs py-1.5 flex-1">
                          Cancelar
                        </button>
                        <button type="submit" disabled={isBankPending}
                          className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1.5">
                          {isBankPending ? (
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          {editingAccount ? 'Guardar cambios' : 'Agregar cuenta'}
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
