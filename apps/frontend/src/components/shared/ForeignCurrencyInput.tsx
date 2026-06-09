export type ForeignCurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD';

export interface ForeignCurrencyValue {
  enabled:       boolean;
  currency:      ForeignCurrencyCode;
  foreignAmount: string;
  exchangeRate:  string;
}

interface Props {
  value:    ForeignCurrencyValue;
  onChange: (next: ForeignCurrencyValue) => void;
  /** Derived RD$ amount displayed as read-only. Pass null if not yet calculable. */
  rdAmount?: number | null;
}

const CURRENCY_LABELS: Record<ForeignCurrencyCode, string> = {
  USD: 'USD — Dólar',
  EUR: 'EUR — Euro',
  GBP: 'GBP — Libra',
  CAD: 'CAD — Dólar canadiense',
};

const CURRENCIES: ForeignCurrencyCode[] = ['USD', 'EUR', 'GBP', 'CAD'];

export function ForeignCurrencyInput({ value, onChange, rdAmount }: Props) {
  const set = (patch: Partial<ForeignCurrencyValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="rounded border-gray-300"
        />
        <span className="text-sm font-medium text-blue-800">
          💱 Pago realizado en moneda extranjera
        </span>
      </label>

      {value.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Moneda</label>
              <select
                value={value.currency}
                onChange={(e) => set({ currency: e.target.value as ForeignCurrencyCode })}
                className="input-field text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{CURRENCY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Monto en {value.currency} *
              </label>
              <input
                type="number"
                value={value.foreignAmount}
                onChange={(e) => set({ foreignAmount: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tasa de cambio (1 {value.currency} = X DOP)
              </label>
              <input
                type="number"
                value={value.exchangeRate}
                onChange={(e) => set({ exchangeRate: e.target.value })}
                placeholder="ej: 60.50"
                min="0"
                step="0.01"
                className="input-field text-sm"
              />
            </div>
          </div>

          {rdAmount != null && rdAmount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              <p className="text-xs text-yellow-700 font-semibold">
                Equivalente: RD$ {rdAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}

          <p className="text-xs text-blue-600">
            El campo <strong>Monto (RD$)</strong> se calcula automáticamente. Puedes ajustarlo si la tasa real fue diferente.
          </p>
        </div>
      )}
    </div>
  );
}
