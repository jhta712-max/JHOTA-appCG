import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import FormModal from '../ui/FormModal';
import { useRncValidation } from '../../hooks/useRncValidation';
import { suppliersApi } from '../../api';

interface QuickCreateSupplierModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (supplier: { id: string; name: string }) => void;
}

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'] as const;
const CURRENCIES = ['RD$', 'US$', '€'] as const;

export default function QuickCreateSupplierModal({ open, onClose, onCreated }: QuickCreateSupplierModalProps) {
  const [name, setName]                   = useState('');
  const [rnc, setRnc]                     = useState('');
  const [phone, setPhone]                 = useState('');
  const [email, setEmail]                 = useState('');
  const [bankName, setBankName]           = useState('');
  const [accountType, setAccountType]     = useState<typeof ACCOUNT_TYPES[number]>('Cuenta de Ahorros');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency]           = useState<typeof CURRENCIES[number]>('RD$');
  const [error, setError]                 = useState('');
  const [saving, setSaving]               = useState(false);

  const rncValidation = useRncValidation(rnc);

  // Auto-fill name from DGII when RNC is valid
  useEffect(() => {
    if (rncValidation.status === 'valid' && rncValidation.name) {
      setName(rncValidation.name);
    }
  }, [rncValidation]);

  const resetForm = () => {
    setName(''); setRnc(''); setPhone(''); setEmail('');
    setBankName(''); setAccountType('Cuenta de Ahorros');
    setAccountNumber(''); setCurrency('RD$');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 2)
      return setError('El nombre es requerido (mínimo 2 caracteres)');
    if (!bankName.trim() || bankName.trim().length < 2)
      return setError('El banco es requerido');
    if (!accountNumber.trim() || accountNumber.trim().length < 4)
      return setError('El número de cuenta es requerido (mínimo 4 caracteres)');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError('Formato de email inválido');

    setSaving(true);
    setError('');

    let supplierId = '';
    let supplierName = '';

    try {
      const res = await suppliersApi.create({
        name: name.trim(),
        rnc:   rnc.trim()   || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      supplierId   = res.data.data.id;
      supplierName = res.data.data.name;
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al crear el suplidor');
      setSaving(false);
      return;
    }

    try {
      await suppliersApi.addBankAccount(supplierId, {
        bankName:      bankName.trim(),
        accountType,
        accountNumber: accountNumber.trim(),
        currency,
      });
    } catch {
      // Bank account failed — supplier was created, inform user
      setError('Suplidor creado, pero hubo un error al registrar la cuenta bancaria. Puedes agregarla manualmente en el módulo de Suplidores.');
      setSaving(false);
      return;
    }

    setSaving(false);
    resetForm();
    onCreated({ id: supplierId, name: supplierName });
    onClose();
  };

  if (!open) return null;

  return (
    <FormModal title="Nuevo Suplidor" onClose={handleClose} maxWidth="max-w-lg">
      <div className="p-6 space-y-5">

        {error && (
          <div className="flex items-start gap-2 bg-[#1C1C1C] border border-red-500/40 text-red-400 px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Section: Suplidor */}
        <div>
          <p className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-1 mb-3">
            Suplidor
          </p>

          <div className="space-y-3">
            {/* RNC */}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                RNC <span className="font-normal normal-case text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={rnc}
                onChange={(e) => setRnc(e.target.value)}
                placeholder="000000000"
                maxLength={11}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] rounded-none"
              />
              {rncValidation.status === 'validating' && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Verificando en DGII...
                </p>
              )}
              {rncValidation.status === 'valid' && (
                <p className="text-xs text-green-600 mt-1 font-bold">
                  ✓ {rncValidation.name} — {rncValidation.dgiiStatus}
                </p>
              )}
              {rncValidation.status === 'not_found' && (
                <p className="text-xs text-amber-600 mt-1">⚠ RNC no encontrado en DGII</p>
              )}
              {rncValidation.status === 'invalid_format' && (
                <p className="text-xs text-red-500 mt-1">Formato inválido (9 o 11 dígitos)</p>
              )}
              {rncValidation.status === 'unreachable' && (
                <p className="text-xs text-gray-400 mt-1">DGII no disponible — se guardará sin validar</p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre o razón social"
                maxLength={200}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] rounded-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Phone */}
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Teléfono <span className="font-normal normal-case text-gray-400">(opc.)</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="809-000-0000"
                  maxLength={20}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] rounded-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Email <span className="font-normal normal-case text-gray-400">(opc.)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] rounded-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Cuenta Bancaria */}
        <div>
          <p className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-1 mb-3">
            Cuenta Bancaria
          </p>

          <div className="space-y-3">
            {/* Bank Name */}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Banco <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Banreservas, Popular, BHD..."
                maxLength={100}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] rounded-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Account Type */}
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Tipo <span className="text-red-400">*</span>
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as typeof ACCOUNT_TYPES[number])}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] rounded-none"
                >
                  {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Currency */}
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Moneda <span className="text-red-400">*</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as typeof CURRENCIES[number])}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] rounded-none"
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Account Number */}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Número de cuenta <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="000-000000-0"
                maxLength={50}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] rounded-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-2 border-t border-gray-100 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors uppercase tracking-wide"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</>
            ) : (
              'Crear Suplidor'
            )}
          </button>
        </div>
      </div>
    </FormModal>
  );
}
