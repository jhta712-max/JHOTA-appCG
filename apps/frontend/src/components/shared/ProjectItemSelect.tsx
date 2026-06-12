import { useProjectItems } from '../../hooks/useProjectItems';

interface Props {
  projectId?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Selector de item de proyecto. Solo se renderiza si el proyecto tiene items activos.
 * Si required=true (defecto) se marca como obligatorio cuando hay items.
 */
export function ProjectItemSelect({ projectId, value, onChange, required = true, disabled, className }: Props) {
  const { data: items = [] } = useProjectItems(projectId);
  const activeItems = items.filter((i) => i.active);

  if (!projectId || activeItems.length === 0) return null;

  return (
    <div className={className}>
      <label className="block font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-[0.1em] mb-1">
        Item del Proyecto {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] bg-white"
      >
        <option value="">— Selecciona un item —</option>
        {activeItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.number}. {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}
