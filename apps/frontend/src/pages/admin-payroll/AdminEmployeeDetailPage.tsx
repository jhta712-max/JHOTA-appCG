import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { adminEmployeesApi, type AdminEmployeeBenefit } from '../../api/index';
import FormModal from '../../components/ui/FormModal';
import { useRole } from '../../hooks/useRole';

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2 }).format(n);
const inputCls = "w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]";

export default function AdminEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSupervisor } = useRole();
  const canEdit = isAdmin || isSupervisor;

  const [benefitModal, setBenefitModal] = useState<{ open: boolean; data: Partial<AdminEmployeeBenefit> | null }>({ open: false, data: null });

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-employee', id],
    queryFn:  () => adminEmployeesApi.getById(id!),
  });

  const emp = res?.data.data;

  const addBenefitMut = useMutation({
    mutationFn: (d: unknown) => adminEmployeesApi.addBenefit(id!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-employee', id] }); setBenefitModal({ open: false, data: null }); },
  });

  const deleteBenefitMut = useMutation({
    mutationFn: (bId: string) => adminEmployeesApi.deleteBenefit(id!, bId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-employee', id] }),
  });

  const onBenefitSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addBenefitMut.mutate({
      name:       fd.get('name'),
      amount:     Number(fd.get('amount')),
      affectsISR: fd.get('affectsISR') === 'true',
    });
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Cargando...</p></div>;
  if (!emp) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0D1B48] px-4 md:px-6 py-4 md:py-5">
        <button onClick={() => navigate('/admin-payroll/employees')} className="flex items-center gap-1 text-[#1D4ED8] text-xs uppercase font-['Barlow_Condensed'] mb-3">
          <ChevronLeft size={14} /> Empleados
        </button>
        <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight">{emp.name}</h1>
        <p className="text-gray-400 text-sm font-['DM_Sans'] mt-1">{emp.position}</p>
      </div>

      <div className="px-4 md:px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Datos del empleado */}
        <div className="md:col-span-1 bg-white border border-gray-200 p-4 md:p-5">
          <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em] mb-4">Datos</h2>
          {[
            ['Salario base', `RD$ ${fmt(emp.baseSalary)}`],
            ['Frecuencia', emp.paymentFrequency === 'MONTHLY' ? 'Mensual' : 'Quincenal'],
            ['Ingreso', emp.hireDate.slice(0,10)],
            ['Estado', emp.status],
            ['Banco', emp.bankName ?? '—'],
            ['Cuenta', emp.bankAccount ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500 font-['DM_Sans']">{k}</span>
              <span className="text-xs font-bold text-gray-900 font-['Space_Mono']">{v}</span>
            </div>
          ))}
        </div>

        <div className="md:col-span-2 flex flex-col gap-6">
          {/* Beneficios */}
          <div className="bg-white border border-gray-200 p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em]">Beneficios Fijos</h2>
              {canEdit && (
                <button onClick={() => setBenefitModal({ open: true, data: {} })} className="flex items-center gap-1 text-xs bg-[#1D4ED8] text-[#0D1B48] px-3 py-1 font-bold uppercase font-['Barlow_Condensed']">
                  <Plus size={12} /> Agregar
                </button>
              )}
            </div>
            {(emp.benefits ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 font-['DM_Sans']">Sin beneficios registrados</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0D1B48]">
                    {['Concepto','Monto','Afecta ISR',''].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.1em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(emp.benefits ?? []).map((b) => (
                    <tr key={b.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-['DM_Sans']">{b.name}</td>
                      <td className="px-3 py-2 font-['Space_Mono']">RD$ {fmt(b.amount)}</td>
                      <td className="px-3 py-2 font-['DM_Sans'] text-xs">{b.affectsISR ? 'Sí' : 'No'}</td>
                      <td className="px-3 py-2">
                        {canEdit && (
                          <button onClick={() => deleteBenefitMut.mutate(b.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Historial salarial */}
          <div className="bg-white border border-gray-200 p-4 md:p-5">
            <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em] mb-4">Historial Salarial</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0D1B48]">
                  {['Salario base','Vigente desde'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.1em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(emp.salaryHistory ?? []).map((h) => (
                  <tr key={h.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-['Space_Mono']">RD$ {fmt(h.baseSalary)}</td>
                    <td className="px-3 py-2 font-['DM_Sans'] text-gray-600">{h.effectiveFrom.slice(0,10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {benefitModal.open && (
        <FormModal
          title="Agregar Beneficio"
          onClose={() => setBenefitModal({ open: false, data: null })}
        >
          <form onSubmit={onBenefitSubmit} className="p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Concepto</label>
              <input name="name" required className={inputCls} placeholder="Ej: Vehículo, Viáticos, Comunicaciones" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Monto mensual (RD$)</label>
              <input name="amount" type="number" min="0" step="0.01" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">¿Afecta cálculo de ISR?</label>
              <select name="affectsISR" className={inputCls}>
                <option value="true">Sí (forma parte de la base imponible)</option>
                <option value="false">No (exento de ISR)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setBenefitModal({ open: false, data: null })}
                className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] border border-gray-200 text-gray-600 hover:border-gray-400">
                Cancelar
              </button>
              <button type="submit" disabled={addBenefitMut.isPending}
                className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] bg-[#1D4ED8] text-[#0D1B48] disabled:opacity-50">
                {addBenefitMut.isPending ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </form>
        </FormModal>
      )}
    </div>
  );
}
