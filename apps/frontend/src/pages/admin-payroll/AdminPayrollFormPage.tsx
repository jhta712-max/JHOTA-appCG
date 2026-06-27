import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { adminPayrollsApi } from '../../api/index';

const inputCls = "w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]";

export default function AdminPayrollFormPage() {
  const navigate = useNavigate();

  const createMut = useMutation({
    mutationFn: (d: unknown) => adminPayrollsApi.create(d),
    onSuccess:  (res) => navigate(`/admin-payroll/${res.data.data.id}`),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMut.mutate({
      periodType:  fd.get('periodType'),
      periodStart: fd.get('periodStart'),
      periodEnd:   fd.get('periodEnd'),
      notes:       fd.get('notes') || null,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0D1B48] px-4 md:px-6 py-4 md:py-5">
        <button onClick={() => navigate('/admin-payroll')} className="flex items-center gap-1 text-[#1D4ED8] text-xs uppercase font-['Barlow_Condensed'] mb-3">
          <ChevronLeft size={14} /> Períodos
        </button>
        <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight">Nuevo Período</h1>
        <p className="text-gray-400 text-sm font-['DM_Sans'] mt-1">
          Se generarán líneas automáticamente para todos los empleados activos con la frecuencia seleccionada.
        </p>
      </div>

      <div className="px-4 md:px-6 py-6 md:py-8 max-w-lg">
        <form onSubmit={onSubmit} className="bg-white border border-gray-200 p-4 md:p-5 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Tipo de período</label>
            <select name="periodType" required className={inputCls}>
              <option value="MONTHLY">Mensual</option>
              <option value="BIWEEKLY_1">Quincena 1 (días 1–15)</option>
              <option value="BIWEEKLY_2">Quincena 2 (días 16–fin)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Fecha inicio</label>
              <input name="periodStart" type="date" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Fecha fin</label>
              <input name="periodEnd" type="date" required className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Notas (opcional)</label>
            <textarea name="notes" rows={3} className={inputCls} />
          </div>
          {createMut.isError && (
            <p className="text-sm text-red-600 font-['DM_Sans']">
              {(createMut.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al crear el período'}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => navigate('/admin-payroll')} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 font-['DM_Sans']">
              Cancelar
            </button>
            <button type="submit" disabled={createMut.isPending} className="px-4 py-2 text-sm bg-[#1D4ED8] text-[#0D1B48] font-bold uppercase font-['Barlow_Condensed'] disabled:opacity-50">
              {createMut.isPending ? 'Generando...' : 'Generar Período'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
