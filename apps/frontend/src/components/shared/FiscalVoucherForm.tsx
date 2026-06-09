import { Receipt } from 'lucide-react';
import { NCF_REGEX, E_NCF_REGEX, RNC_REGEX } from '../../utils/fiscal';

export interface FiscalVoucherValue {
  hasFiscal:    boolean;
  ncf:          string;
  supplierRnc:  string;
  supplierName: string;
  itbisAmount:  string;
}

interface Props {
  value:    FiscalVoucherValue;
  onChange: (next: FiscalVoucherValue) => void;
  defaultRnc?:  string;
  defaultName?: string;
  aiFields?: Set<string>;
  error?: string;
}

export function FiscalVoucherForm({ value, onChange, defaultRnc, defaultName, aiFields, error }: Props) {
  const set = (patch: Partial<FiscalVoucherValue>) => onChange({ ...value, ...patch });

  const ncfError = value.ncf
    ? (!NCF_REGEX.test(value.ncf.toUpperCase()) && !E_NCF_REGEX.test(value.ncf.toUpperCase())
        ? 'NCF inválido (B0100000001 o E310000000001)' : '')
    : '';
  const rncError = value.supplierRnc
    ? (!RNC_REGEX.test(value.supplierRnc) ? 'RNC inválido (9 u 11 dígitos)' : '')
    : '';

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value.hasFiscal}
          onChange={(e) =>
            set({
              hasFiscal:    e.target.checked,
              ncf:          '',
              supplierRnc:  e.target.checked ? (defaultRnc  ?? value.supplierRnc)  : value.supplierRnc,
              supplierName: e.target.checked ? (defaultName ?? value.supplierName) : value.supplierName,
            })
          }
          className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
        />
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-gray-400" />
          Tiene comprobante fiscal (NCF / e-NCF)
        </span>
      </label>

      {value.hasFiscal && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              NCF / e-NCF <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.ncf}
              onChange={(e) => set({ ncf: e.target.value.toUpperCase() })}
              placeholder="B0100000001 o E310000000001"
              maxLength={13}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 uppercase ${
                aiFields?.has('ncf') ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-400 mt-1">NCF: 11 chars (B0100000001) · e-NCF: 13 chars (E310000000001)</p>
            {ncfError && <p className="text-xs text-red-600 mt-0.5">{ncfError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                RNC del suplidor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={value.supplierRnc}
                onChange={(e) => set({ supplierRnc: e.target.value })}
                placeholder="101000000"
                maxLength={11}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 ${
                  aiFields?.has('supplierRnc') ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-300'
                }`}
              />
              {rncError && <p className="text-xs text-red-600 mt-0.5">{rncError}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ITBIS (RD$)</label>
              <input
                type="number"
                value={value.itbisAmount}
                onChange={(e) => set({ itbisAmount: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 ${
                  aiFields?.has('itbisAmount') ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nombre del suplidor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.supplierName}
              onChange={(e) => set({ supplierName: e.target.value })}
              placeholder="Razón social"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 ${
                aiFields?.has('supplierName') ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-300'
              }`}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
