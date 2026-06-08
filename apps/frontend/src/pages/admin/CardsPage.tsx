import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Pencil, PowerOff, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { cardsApi, type CompanyCard } from '../../api';

const CARD_TYPES = ['VISA', 'MASTERCARD', 'AMEX', 'DINERS', 'OTHER'] as const;

type CardForm = {
  holderName: string;
  lastFour:   string;
  cardType:   string;
  bank:       string;
};

const EMPTY_FORM: CardForm = { holderName: '', lastFour: '', cardType: 'VISA', bank: '' };

export default function CardsPage() {
  const qc = useQueryClient();

  const [showAll,     setShowAll]     = useState(false);
  const [modal,       setModal]       = useState<'create' | 'edit' | null>(null);
  const [editing,     setEditing]     = useState<CompanyCard | null>(null);
  const [form,        setForm]        = useState<CardForm>(EMPTY_FORM);
  const [formError,   setFormError]   = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');

  // ── Queries ──────────────────────────────────────────────────
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['cards', showAll ? 'all' : 'active'],
    queryFn:  () => cardsApi.list(!showAll),
    select:   (r) => r.data.data,
  });

  // ── Mutations ────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: CardForm) => cardsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] });
      closeModal();
      flash('Tarjeta registrada exitosamente');
    },
    onError: (err: any) => setFormError(err.response?.data?.error || 'Error al registrar la tarjeta'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CardForm> }) => cardsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] });
      closeModal();
      flash('Tarjeta actualizada');
    },
    onError: (err: any) => setFormError(err.response?.data?.error || 'Error al actualizar'),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: number) => cardsApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] });
      flash('Tarjeta desactivada');
    },
    onError: (err: any) => flash(err.response?.data?.error || 'Error al desactivar', true),
  });

  // ── Helpers ──────────────────────────────────────────────────
  const flash = (msg: string, isError = false) => {
    if (isError) {
      // brief global error — not ideal but simple
      setSuccessMsg('');
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModal('create');
  };

  const openEdit = (card: CompanyCard) => {
    setEditing(card);
    setForm({ holderName: card.holderName, lastFour: card.lastFour, cardType: card.cardType, bank: card.bank });
    setFormError('');
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.holderName.trim())          return setFormError('El nombre del tarjeta-habiente es requerido');
    if (!/^\d{4}$/.test(form.lastFour))   return setFormError('Los últimos 4 dígitos deben ser 4 números');
    if (!form.bank.trim())                 return setFormError('El banco es requerido');

    if (modal === 'create') {
      createMut.mutate(form);
    } else if (editing) {
      updateMut.mutate({ id: editing.id, data: form });
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  // ── Card type badge ──────────────────────────────────────────
  const TYPE_COLORS: Record<string, string> = {
    VISA:       'bg-blue-100 text-blue-700',
    MASTERCARD: 'bg-red-100 text-red-700',
    AMEX:       'bg-green-100 text-green-700',
    DINERS:     'bg-purple-100 text-purple-700',
    OTHER:      'bg-gray-100 text-gray-600',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="module-label">ADMINISTRACIÓN / TARJETAS</p>
          <h1 className="page-title">Tarjetas Corporativas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de tarjetas de pago de la empresa</p>
        </div>
        <button onClick={openCreate} className="smi-btn">
          <Plus className="w-4 h-4" />
          Nueva tarjeta
        </button>
      </div>

      {/* Flash message */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Toggle activas / todas */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAll(false)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!showAll ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          Activas
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showAll ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          Todas
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando tarjetas...</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay tarjetas registradas</p>
            <button onClick={openCreate} className="mt-3 text-sm text-primary-600 hover:underline">
              Agregar primera tarjeta
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarjeta-habiente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Banco</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Últimos 4</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cards.map((card) => (
                <tr key={card.id} className={`hover:bg-gray-50 transition-colors ${!card.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{card.holderName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[card.cardType] ?? TYPE_COLORS.OTHER}`}>
                      {card.cardType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{card.bank}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">**** {card.lastFour}</td>
                  <td className="px-4 py-3">
                    {card.isActive
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Activa</span>
                      : <span className="text-xs text-gray-400">Inactiva</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(card)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {card.isActive && (
                        <button
                          onClick={() => { if (confirm(`¿Desactivar tarjeta **** ${card.lastFour} de ${card.holderName}?`)) deactivateMut.mutate(card.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Desactivar"
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

      {/* ── Modal crear / editar ──────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-600" />
                {modal === 'create' ? 'Nueva tarjeta corporativa' : 'Editar tarjeta'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nombre del tarjeta-habiente *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Juan Pérez"
                  value={form.holderName}
                  onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo de tarjeta *</label>
                  <select
                    className="input-field"
                    value={form.cardType}
                    onChange={(e) => setForm((f) => ({ ...f, cardType: e.target.value }))}
                  >
                    {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Últimos 4 dígitos *</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="0000"
                    maxLength={4}
                    value={form.lastFour}
                    onChange={(e) => setForm((f) => ({ ...f, lastFour: e.target.value.replace(/\D/g, '') }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Banco *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Banco Popular"
                  value={form.bank}
                  onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={isSaving} className="btn-primary flex-1">
                  {isSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : <><CheckCircle className="w-4 h-4" /> {modal === 'create' ? 'Registrar' : 'Guardar cambios'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
