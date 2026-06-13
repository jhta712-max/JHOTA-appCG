import { useBatchItems } from '../../hooks/useBatchItems';

interface Props {
  projectId?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Selector de ítem (batch item) del proyecto.
 * Solo se renderiza si el proyecto tiene batch items activos.
 */
export function BatchItemSelect({ projectId, value, onChange, required = true, disabled, className }: Props) {
  const { data: items = [] } = useBatchItems(projectId);

  if (!projectId || items.length === 0) return null;

  return (
    <div className={className}>
      <label className="block font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-[0.1em] mb-1">
        Ítem del proyecto {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] bg-white"
      >
        <option value="">— Selecciona un ítem —</option>
        {items.map((item: any) => (
          <option key={item.id} value={item.id}>
            {item.code} — {item.description}
            {item.sector ? ` (${item.sector})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
