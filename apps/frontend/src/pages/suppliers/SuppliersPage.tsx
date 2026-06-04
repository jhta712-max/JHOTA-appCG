import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Search, X, AlertCircle, CheckCircle,
  Phone, Mail, Hash, ChevronRight, ToggleLeft, ToggleRight, Pencil,
} from 'lucide-react';
import { suppliersApi } from '../../api';
import { useRole }       from '../../hooks/useRole';
import type { Supplier } from '../../types';

// ── Tipos de formulario ───────────────────────────────────────
type SupplierForm = {
  name:    string;
  rnc:     string;
  phone:   string;
  email:   string;
  address: string;
  notes:   string;
};

const EMPTY_FORM: SupplierForm = {
  name: '', rnc: '', phone: '', email: '', address: '', notes: '',
};

function formToPayload(f: SupplierForm) {
  return {
    name:    f.name.trim(),
    rnc:     f.rnc.trim()     || null,
    phone:   f.phone.trim()   || null,
    email:   f.email.trim()   || null,
    address: f.address.trim() || null,
    notes:   f.notes.trim()   || null,
  };
}

// ── Componente principal ──────────────────────────────────────
export default function SuppliersPage() {
  const qc   = useQueryClient();
  const role = useRole();

  const [search,    setSearch]    = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null);
  const [editing,   setEditing]   = useState<Supplier | null>(null);
  const [form,      setForm]      = useState<SupplierForm>(EMPTY_FORM);
  const [apiError,  setApiError]  = useState('');
  const [apiOk,     setApiOk]     = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e: any) => setApiError(e.response?.data?.error ?? 'Error al cambiar estado'),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setApiError('');
    setModal('create');
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name:    s.name,
      rnc:     s.rnc     ?? '',
      phone:   s.phone   ?? '',
      email:   s.email   ?? '',
      address: s.address ?? '',
      notes:   s.notes   ?? '',
    });
    setApiError('');
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setApiError('');
    setForm(EMPTY_FORM);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
    if (modal === 'create') {
      createMutation.mutate(payload);
    } else if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            Directorio de Suplidores
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {suppliers?.length ?? 0} suplidor{(suppliers?.length ?? 0) !== 1 ? 'es' : ''} registrado{(suppliers?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        {role.canManageSuppliers && (
          <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo suplidor
          </button>
        )}
      </div>

      {/* Feedback banners */}
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
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
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
            <div
              key={s.id}
              className={`card p-4 flex items-center gap-4 transition-all ${!s.isActive ? 'opacity-60' : ''}`}
            >
              {/* Icono */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: s.isActive ? '#F5C218' : '#E5E7EB' }}>
                <Building2 className="w-5 h-5 text-gray-900" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm truncate">{s.name}</p>
                  {!s.isActive && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {s.rnc && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      RNC: {s.rnc}
                    </span>
                  )}
                  {s.phone && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {s.phone}
                    </span>
                  )}
                  {s.email && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {s.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 shrink-0">
                {role.canManageSuppliers && (
                  <>
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar suplidor"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate(s.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        s.isActive
                          ? 'text-green-500 hover:text-green-700 hover:bg-green-50'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title={s.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {s.isActive
                        ? <ToggleRight className="w-5 h-5" />
                        : <ToggleLeft  className="w-5 h-5" />
                      }
                    </button>
                  </>
                )}
                <Link
                  to={`/suppliers/${s.id}`}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                >
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

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-900">
                {modal === 'create' ? 'Nuevo suplidor' : 'Editar suplidor'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="label">Nombre <span className="text-red-500">*</span></label>
                <input
                  className="input-field"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ej: Ferretería La Central, S.R.L."
                  required
                  minLength={2}
                  maxLength={200}
                />
              </div>

              {/* RNC */}
              <div>
                <label className="label">RNC</label>
                <input
                  className="input-field"
                  name="rnc"
                  value={form.rnc}
                  onChange={handleChange}
                  placeholder="9 u 11 dígitos"
                  maxLength={11}
                />
                <p className="text-xs text-gray-400 mt-1">Registro Nacional del Contribuyente (opcional)</p>
              </div>

              {/* Teléfono y Email en fila */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Teléfono</label>
                  <input
                    className="input-field"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="809-000-0000"
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="label">Correo electrónico</label>
                  <input
                    className="input-field"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="contacto@empresa.com"
                    maxLength={150}
                  />
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label className="label">Dirección</label>
                <input
                  className="input-field"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Calle, sector, ciudad"
                  maxLength={500}
                />
              </div>

              {/* Notas */}
              <div>
                <label className="label">Notas</label>
                <textarea
                  className="input-field resize-none"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Información adicional..."
                  rows={3}
                  maxLength={1000}
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {modal === 'create' ? 'Crear suplidor' : 'Guardar cambios'}
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
