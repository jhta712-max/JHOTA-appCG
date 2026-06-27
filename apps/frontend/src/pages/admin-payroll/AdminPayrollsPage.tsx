import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Download } from 'lucide-react';
import { adminPayrollsApi, type AdminPayroll } from '../../api/index';
import { useRole } from '../../hooks/useRole';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada' };
const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-600',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID:     'bg-green-100 text-green-800',
  VOIDED:   'bg-red-100 text-red-700',
};
const PERIOD_LABEL: Record<string, string> = { MONTHLY: 'Mensual', BIWEEKLY_1: 'Quincena 1', BIWEEKLY_2: 'Quincena 2' };

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2 }).format(n);

export default function AdminPayrollsPage() {
  const navigate = useNavigate();
  const { isAdmin, isSupervisor } = useRole();
  const canCreate = isAdmin || isSupervisor;

  const [year, setYear]     = useState(new Date().getFullYear());
  const [status, setStatus] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-payrolls', year, status],
    queryFn:  () => adminPayrollsApi.list({ year, status: status || undefined, limit: 50 }),
  });

  const payrolls: AdminPayroll[] = res?.data.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0D1B48] px-4 md:px-6 py-4 md:py-5">
        <p className="text-[#1D4ED8] text-xs font-bold uppercase tracking-[0.2em] font-['Barlow_Condensed'] mb-1">
          Nómina Administrativa
        </p>
        <div className="flex items-center justify-between">
          <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight">Períodos</h1>
          {canCreate && (
            <button onClick={() => navigate('/admin-payroll/new')} className="flex items-center gap-2 bg-[#1D4ED8] text-[#0D1B48] px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed']">
              <Plus size={16} /> Nuevo Período
            </button>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6 py-4 flex gap-3">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-gray-200 px-3 py-1.5 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8]">
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 px-3 py-1.5 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8]">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="px-4 md:px-6 pb-8">
        {isLoading ? (
          <p className="text-sm text-gray-400 font-['DM_Sans']">Cargando...</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0D1B48]">
                    {['#','Tipo','Período','Empleados','Total Bruto','Total Neto','Estado',''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-['Space_Mono'] text-gray-500 text-xs">NOM-ADM-{String(p.number).padStart(3,'0')}</td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-gray-700">{PERIOD_LABEL[p.periodType]}</td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-gray-600 text-xs">{p.periodStart.slice(0,10)} — {p.periodEnd.slice(0,10)}</td>
                      <td className="px-4 py-3 font-['Space_Mono'] text-gray-600 text-center">{p._count?.lines ?? 0}</td>
                      <td className="px-4 py-3 font-['Space_Mono'] text-gray-900">RD$ {fmt(p.totalGross)}</td>
                      <td className="px-4 py-3 font-['Space_Mono'] font-bold text-gray-900">RD$ {fmt(p.totalNet)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-bold uppercase ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <Link to={`/admin-payroll/${p.id}`} className="text-xs text-[#0D1B48] underline font-['DM_Sans']">Ver</Link>
                          {p.status !== 'VOIDED' && (
                            <a href={adminPayrollsApi.exportUrl(p.id)} className="text-xs text-gray-500" title="Exportar Excel">
                              <Download size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {payrolls.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 font-['DM_Sans'] text-sm">No hay períodos registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden bg-white border border-gray-200 divide-y divide-gray-100">
              {payrolls.length === 0 && (
                <p className="px-4 py-8 text-center text-gray-400 font-['DM_Sans'] text-sm">No hay períodos registrados</p>
              )}
              {payrolls.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-['Space_Mono'] text-gray-500 text-xs">NOM-ADM-{String(p.number).padStart(3,'0')}</span>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <p className="font-['DM_Sans'] text-gray-700 text-sm font-medium">{PERIOD_LABEL[p.periodType]}</p>
                  <p className="font-['DM_Sans'] text-gray-500 text-xs mt-0.5">{p.periodStart.slice(0,10)} — {p.periodEnd.slice(0,10)}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 font-['DM_Sans']">Neto</p>
                      <p className="font-['Space_Mono'] font-bold text-gray-900 text-sm">RD$ {fmt(p.totalNet)}</p>
                    </div>
                    <div className="flex gap-3">
                      <Link to={`/admin-payroll/${p.id}`} className="text-xs text-[#0D1B48] underline font-['DM_Sans']">Ver</Link>
                      {p.status !== 'VOIDED' && (
                        <a href={adminPayrollsApi.exportUrl(p.id)} className="text-xs text-gray-500" title="Exportar Excel">
                          <Download size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
