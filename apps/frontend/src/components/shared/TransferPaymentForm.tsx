import { Receipt } from 'lucide-react';

export interface TransferPaymentValue {
  paymentMethod:    'CASH' | 'TRANSFER';
  paymentDate?:     string;
  paymentBank:      string;
  paymentReference: string;
  receiptNumber?:   string;
  receivedBy?:      string;
}

interface Props {
  value:    TransferPaymentValue;
  onChange: (next: TransferPaymentValue) => void;
  /** Show CASH/TRANSFER radio selector + date field. Default: false */
  showMethodSelector?: boolean;
  /** Show cash receipt fields (receiptNumber, receivedBy). Only relevant when showMethodSelector=true */
  showCash?: boolean;
  /** Label for the bank field. Default: "Banco emisor" */
  bankLabel?: string;
}

export function TransferPaymentForm({
  value, onChange,
  showMethodSelector = false,
  showCash = false,
  bankLabel = 'Banco emisor',
}: Props) {
  const set = (patch: Partial<TransferPaymentValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      {showMethodSelector && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago *</label>
            <div className="flex gap-4">
              {(['CASH', 'TRANSFER'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="payMethod"
                    value={m}
                    checked={value.paymentMethod === m}
                    onChange={() => set({ paymentMethod: m })}
                    className="accent-yellow-500"
                  />
                  {m === 'CASH' ? 'Efectivo' : 'Transferencia bancaria'}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago *</label>
            <input
              type="date"
              value={value.paymentDate ?? ''}
              onChange={(e) => set({ paymentDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        </>
      )}

      {(!showMethodSelector || value.paymentMethod === 'TRANSFER') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{bankLabel}</label>
            <input
              type="text"
              value={value.paymentBank}
              onChange={(e) => set({ paymentBank: e.target.value })}
              placeholder="ej. BHD, BanReservas"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">No. de transacción</label>
            <input
              type="text"
              value={value.paymentReference}
              onChange={(e) => set({ paymentReference: e.target.value })}
              placeholder="ej. 123456789"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>
        </div>
      )}

      {showCash && showMethodSelector && value.paymentMethod === 'CASH' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Datos del recibo (obligatorios para efectivo)
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. de recibo *</label>
            <input
              type="text"
              value={value.receiptNumber ?? ''}
              onChange={(e) => set({ receiptNumber: e.target.value })}
              placeholder="Ej: REC-001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de quien recibió *</label>
            <input
              type="text"
              value={value.receivedBy ?? ''}
              onChange={(e) => set({ receivedBy: e.target.value })}
              placeholder="Nombre completo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}
