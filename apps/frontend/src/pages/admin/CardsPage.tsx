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

const TYPE_ACCENT: Record<string, string> = {
  VISA:       'text-blue-400',
  MASTERCARD: 'text-red-400',
  AMEX:       'text-green-400',
  DINERS:     'text-purple-400',
  OTHER:      'text-gray-400',
};

export default function CardsPage() {
  const qc = useQueryClient();

  const [showAll,     setShowAll]     = useState(false);
  const [modal,       setModal]       = useState<'create' | 'edit' | null>(null);
  const [editing,     setEditing]     = useState<CompanyCard | null>(null);
  const [form,        setForm]        = useState<CardForm>(EMPTY_FORM);
  const [formError,   setFormError]   = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['cards', showAll ? 'all' : 'active'],
    queryFn:  () => cardsApi.list(!showAll),
    select:   (r) => r.data.data,
  });

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

  const flash = (msg: string, isError = false) => {
    if (isError) {
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

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero Header */}
      <div className="bg-[#1C1C1C]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.2em] text-[#F5C218] uppercase mb-2">
            ADMINISTRACIÓN / TARJETAS
          </p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight leading-none">
                TARJETAS CORPORATIVAS
              </h1>
              <p className="font-['DM_Sans'] text-sm text-gray-400 mt-3">
                Gestión de tarjetas de pago de la empresa
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Nueva tarjeta
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Flash message */}
        {successMsg && (
          <div className="flex items-center gap-2 bg-[#1C1C1C] border border-[#F5C218]/40 text-[#F5C218] p-3 font-['DM_Sans'] text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <p className="flex-1">{successMsg}</p>
          </div>
        )}

        {/* Toggle activas / todas */}
        <div className="flex items-center gap-1 border border-gray-200 bg-white w-fit">
          <button
            onClick={() => setShowAll(false)}
            className={`px-4 py-2 font-['DM_Sans'] text-sm font-medium transition-all ${
              !showAll
                ? 'bg-[#1C1C1C] text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Activas
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-4 py-2 font-['DM_Sans'] text-sm font-medium transition-all ${
              showAll
                ? 'bg-[#1C1C1C] text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Todas
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 font-['DM_Sans'] text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando tarjetas...</span>
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-16">
              <CreditCard className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="font-['DM_Sans'] text-sm text-gray-400">No hay tarjetas registradas</p>
              <button
                onClick={openCreate}
                className="mt-4 bg-[#F5C218] text-[#1C1C1C] px-4 py-2 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors"
              >
                Agregar primera tarjeta
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#1C1C1C]">
                <tr>
                  <th className="text-left px-5 py-3.5 font-['Barlow_Condensed'] text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">Tarjeta-habiente</th>
                  <th className="text-left px-5 py-3.5 font-['Barlow_Condensed'] text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">Tipo</th>
                  <th className="text-left px-5 py-3.5 font-['Barlow_Condensed'] text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">Banco</th>
                  <th className="text-left px-5 py-3.5 font-['Barlow_Condensed'] text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">Número</th>
                  <th className="text-left px-5 py-3.5 font-['Barlow_Condensed'] text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">Estado</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cards.map((card) => (
                  <tr
                    key={card.id}
                    className={`hover:bg-gray-50 transition-colors ${!card.isActive ? 'opacity-40' : ''}`}
                  >
                    <td className="px-5 py-3.5 font-['DM_Sans'] font-medium text-gray-900 text-sm">{card.holderName}</td>
                    <td className="px-5 py-3.5">
                      <span className={`font-['Space_Mono'] text-xs font-semibold ${TYPE_ACCENT[card.cardType] ?? TYPE_ACCENT.OTHER}`}>
                        {card.cardType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-['DM_Sans'] text-sm text-gray-500">{card.bank}</td>
                    <td className="px-5 py-3.5 font-['Space_Mono'] text-sm text-gray-700">**** {card.lastFour}</td>
                    <td className="px-5 py-3.5">
                      {card.isActive
                        ? <span className="inline-flex items-center gap-1.5 font-['DM_Sans'] text-xs text-green-600">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Activa
                          </span>
                        : <span className="font-['DM_Sans'] text-xs text-gray-400">Inactiva</span>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(card)}
                          className="p-1.5 text-gray-400 hover:text-[#F5C218] hover:bg-[#F5C218]/10 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {card.isActive && (
                          <button
                            onClick={() => {
                              if (confirm(`¿Desactivar tarjeta **** ${card.lastFour} de ${card.holderName}?`))
                                deactivateMut.mutate(card.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#1C1C1C]">
              <h2 className="font-['Barlow_Condensed'] text-lg font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#F5C218]" />
                {modal === 'create' ? 'Nueva tarjeta corporativa' : 'Editar tarjeta'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-[#F5C218] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 p-3 font-['DM_Sans']">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}

              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Nombre del tarjeta-habiente *
                </label>
                <input
                  type="text"
                  className="w-full font-['DM_Sans'] text-sm border border-gray-200 text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors"
                  placeholder="Ej: Juan Pérez"
                  value={form.holderName}
                  onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                    Tipo *
                  </label>
                  <select
                    className="w-full font-['DM_Sans'] text-sm border border-gray-200 text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors"
                    value={form.cardType}
                    onChange={(e) => setForm((f) => ({ ...f, cardType: e.target.value }))}
                  >
                    {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                    Últimos 4 *
                  </label>
                  <input
                    type="text"
                    className="w-full font-['Space_Mono'] text-sm border border-gray-200 text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors"
                    placeholder="0000"
                    maxLength={4}
                    value={form.lastFour}
                    onChange={(e) => setForm((f) => ({ ...f, lastFour: e.target.value.replace(/\D/g, '') }))}
                  />
                </div>
              </div>

              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Banco *
                </label>
                <input
                  type="text"
                  className="w-full font-['DM_Sans'] text-sm border border-gray-200 text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors"
                  placeholder="Ej: Banco Popular"
                  value={form.bank}
                  onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 font-['DM_Sans'] text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
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
