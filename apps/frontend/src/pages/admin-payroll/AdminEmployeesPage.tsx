import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, User } from 'lucide-react';
import { adminEmployeesApi, type AdminEmployee } from '../../api/index';
import FormModal from '../../components/ui/FormModal';
import { useRole } from '../../hooks/useRole';

const FREQ_LABEL: Record<string, string> = { MONTHLY: 'Mensual', BIWEEKLY: 'Quincenal' };
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activo', SUSPENDED: 'Suspendido', RETIRED: 'Retirado' };
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
  RETIRED:   'bg-gray-100 text-gray-600',
};

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2 }).format(n);

export default function AdminEmployeesPage() {
  const qc = useQueryClient();
  const { isAdmin, isSupervisor } = useRole();
  const canEdit = isAdmin || isSupervisor;

  const [modal, setModal] = useState<{ open: boolean; data: Partial<AdminEmployee> | null }>({ open: false, data: null });

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-employees'],
    queryFn:  () => adminEmployeesApi.list({ limit: 100 }),
  });

  const employees = res?.data.data ?? [];

  const createMut = useMutation({
    mutationFn: (d: unknown) => adminEmployeesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-employees'] }); setModal({ open: false, data: null }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: unknown }) => adminEmployeesApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-employees'] }); setModal({ open: false, data: null }); },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name:             fd.get('name'),
      position:         fd.get('position'),
      hireDate:         fd.get('hireDate'),
      paymentFrequency: fd.get('paymentFrequency'),
      baseSalary:       Number(fd.get('baseSalary')),
      bankName:         fd.get('bankName') || null,
      bankAccount:      fd.get('bankAccount') || null,
      notes:            fd.get('notes') || null,
    };
    if (modal.data?.id) {
      updateMut.mutate({ id: modal.data.id, d: body });
    } else {
      createMut.mutate(body);
    }
  };

  const inputCls = "w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#1C1C1C] px-4 md:px-6 py-4 md:py-5">
        <p className="text-[#F5C218] text-xs font-bold uppercase tracking-[0.2em] font-['Barlow_Condensed'] mb-1">
          Nómina Administrativa
        </p>
        <div className="flex items-center justify-between">
          <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight">
            Empleados
          </h1>
          {canEdit && (
            <button
              onClick={() => setModal({ open: true, data: {} })}
              className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed']"
            >
              <Plus size={16} /> Nuevo Empleado
            </button>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6 py-6">
        {isLoading ? (
          <p className="text-sm text-gray-400 font-['DM_Sans']">Cargando...</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1C1C1C]">
                    {['Empleado','Cargo','Frecuencia','Salario Base','Estado',''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-['DM_Sans'] font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          {emp.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-gray-600">{emp.position}</td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-gray-600">{FREQ_LABEL[emp.paymentFrequency]}</td>
                      <td className="px-4 py-3 font-['Space_Mono'] text-gray-900">RD$ {fmt(emp.baseSalary)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-bold uppercase ${STATUS_COLOR[emp.status]}`}>
                          {STATUS_LABEL[emp.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <Link to={`/admin-payroll/employees/${emp.id}`} className="text-xs text-[#1C1C1C] underline font-['DM_Sans']">
                            Ver detalle
                          </Link>
                          {canEdit && (
                            <button onClick={() => setModal({ open: true, data: emp })} className="text-xs text-gray-500 underline font-['DM_Sans']">
                              Editar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-['DM_Sans'] text-sm">No hay empleados registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden bg-white border border-gray-200 divide-y divide-gray-100">
              {employees.length === 0 && (
                <p className="px-4 py-8 text-center text-gray-400 font-['DM_Sans'] text-sm">No hay empleados registrados</p>
              )}
              {employees.map((emp) => (
                <div key={emp.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="font-['DM_Sans'] font-medium text-gray-900 text-sm">{emp.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase ${STATUS_COLOR[emp.status]}`}>
                      {STATUS_LABEL[emp.status]}
                    </span>
                  </div>
                  <p className="font-['DM_Sans'] text-gray-500 text-xs">{emp.position} · {FREQ_LABEL[emp.paymentFrequency]}</p>
                  <p className="font-['Space_Mono'] text-gray-900 text-sm mt-1">RD$ {fmt(emp.baseSalary)}</p>
                  <div className="flex gap-3 mt-2">
                    <Link to={`/admin-payroll/employees/${emp.id}`} className="text-xs text-[#1C1C1C] underline font-['DM_Sans']">
                      Ver detalle
                    </Link>
                    {canEdit && (
                      <button onClick={() => setModal({ open: true, data: emp })} className="text-xs text-gray-500 underline font-['DM_Sans']">
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {modal.open && (
        <FormModal
          title={modal.data?.id ? 'Editar Empleado' : 'Nuevo Empleado'}
          onClose={() => setModal({ open: false, data: null })}
        >
          <form onSubmit={onSubmit} className="p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Nombre completo</label>
                <input name="name" defaultValue={modal.data?.name ?? ''} required className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Cargo</label>
                <input name="position" defaultValue={modal.data?.position ?? ''} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Fecha de ingreso</label>
                <input name="hireDate" type="date" defaultValue={modal.data?.hireDate?.slice(0,10) ?? ''} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Frecuencia de pago</label>
                <select name="paymentFrequency" defaultValue={modal.data?.paymentFrequency ?? 'MONTHLY'} className={inputCls}>
                  <option value="MONTHLY">Mensual</option>
                  <option value="BIWEEKLY">Quincenal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Salario base (RD$)</label>
                <input name="baseSalary" type="number" min="0" step="0.01" defaultValue={modal.data?.baseSalary ?? ''} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Banco</label>
                <input name="bankName" defaultValue={modal.data?.bankName ?? ''} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Número de cuenta</label>
                <input name="bankAccount" defaultValue={modal.data?.bankAccount ?? ''} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Notas</label>
                <textarea name="notes" defaultValue={modal.data?.notes ?? ''} rows={2} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setModal({ open: false, data: null })}
                className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] border border-gray-200 text-gray-600 hover:border-gray-400">
                Cancelar
              </button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] bg-[#F5C218] text-[#1C1C1C] disabled:opacity-50">
                {createMut.isPending || updateMut.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </FormModal>
      )}
    </div>
  );
}
