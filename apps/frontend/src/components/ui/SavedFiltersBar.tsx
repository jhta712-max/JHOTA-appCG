import { useState } from 'react';
import { Bookmark, BookmarkCheck, X, ChevronDown } from 'lucide-react';
import { useSavedFilters } from '../../hooks/useSavedFilters';

interface Props<T> {
  namespace:     string;
  currentFilters: T;
  onApply:       (filters: T) => void;
}

export function SavedFiltersBar<T>({ namespace, currentFilters, onApply }: Props<T>) {
  const { saved, save, remove } = useSavedFilters<T>(namespace);
  const [open,    setOpen]    = useState(false);
  const [newName, setNewName] = useState('');
  const [saving,  setSaving]  = useState(false);

  function handleSave() {
    const name = newName.trim();
    if (!name) return;
    save(name, currentFilters);
    setNewName('');
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Saved filter chips */}
      {saved.map((sf) => (
        <div key={sf.id} className="flex items-center gap-0 border border-[#F5C218]/40 bg-[#F5C218]/5">
          <button
            onClick={() => onApply(sf.filters)}
            className="px-2.5 py-1 text-xs font-bold font-['Barlow_Condensed'] text-[#1C1C1C] uppercase tracking-wide hover:bg-[#F5C218]/20 transition-colors">
            {sf.name}
          </button>
          <button
            onClick={() => remove(sf.id)}
            title="Eliminar vista"
            className="px-1.5 py-1 text-gray-400 hover:text-red-500 transition-colors border-l border-[#F5C218]/20">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Save current button */}
      {saving ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false); }}
            placeholder="Nombre de la vista..."
            className="text-xs px-2 py-1 border border-[#F5C218] focus:outline-none focus:ring-1 focus:ring-[#F5C218] font-['DM_Sans'] w-40"
          />
          <button onClick={handleSave}
            className="px-2 py-1 bg-[#F5C218] text-[#1C1C1C] text-xs font-bold uppercase tracking-wide hover:bg-yellow-300 transition-colors">
            Guardar
          </button>
          <button onClick={() => setSaving(false)}
            className="px-2 py-1 border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSaving(true)}
          title="Guardar filtros actuales como vista"
          className="flex items-center gap-1.5 px-2.5 py-1 border border-dashed border-gray-300 text-gray-400 text-xs hover:border-[#F5C218] hover:text-[#F5C218] transition-colors font-['DM_Sans']">
          <Bookmark className="w-3 h-3" />
          Guardar vista
        </button>
      )}
    </div>
  );
}
