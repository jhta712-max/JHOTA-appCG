import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Download, CheckCircle, DollarSign, XCircle } from 'lucide-react';
import { adminPayrollsApi, type AdminPayroll } from '../../api/index';
import FormModal from '../../components/ui/FormModal';
import { useRole } from '../../hooks/useRole';

const fmt  = (n: number) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2 }).format(n);
const inputCls = "w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800', VOIDED: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada' };

export default function AdminPayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSupervisor } = useRole();

  const [payModal, setPayModal]   = useState(false);
  const [voidModal, setVoidModal] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-payroll', id],
    queryFn:  () => adminPayrollsApi.getById(id!),
  });

  const p: AdminPayroll | undefined = res?.data.data;

  const approveMut = useMutation({
    mutationFn: () => adminPayrollsApi.approve(id!),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-payroll', id] }),
  });

  const payMut = useMutation({
    mutationFn: (d: unknown) => adminPayrollsApi.pay(id!, d),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-payroll', id] }); setPayModal(false); },
  });

  const voidMut = useMutation({
    mutationFn: (reason: string) => adminPayrollsApi.void(id!, reason),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-payroll', id] }); setVoidModal(false); },
  });

  const updateLineMut = useMutation({
    mutationFn: ({ lineId, d }: { lineId: string; d: unknown }) => adminPayrollsApi.updateLine(id!, lineId, d),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-payroll', id] }),
  });

  const onPaySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    payMut.mutate({ paymentMethod: fd.get('paymentMethod'), paymentDate: fd.get('paymentDate'), paymentBank: fd.get('paymentBank') || null, paymentReference: fd.get('paymentReference') || null });
  };

  const onVoidSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    voidMut.mutate(fd.get('voidReason') as string);
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Cargando...</p></div>;
  if (!p) return null;

  const isDraft    = p.status === 'DRAFT';
  const isApproved = p.status === 'APPROVED';
  const isVoided   = p.status === 'VOIDED';
  const canAct     = isAdmin || isSupervisor;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0D1B48] px-4 md:px-6 py-4 md:py-5">
        <button onClick={() => navigate('/admin-payroll')} className="flex items-center gap-1 text-[#1D4ED8] text-xs uppercase font-['Barlow_Condensed'] mb-3">
          <ChevronLeft size={14} /> Períodos
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight">
              NOM-ADM-{String(p.number).padStart(3,'0')}
            </h1>
            <p className="text-gray-400 text-sm font-['DM_Sans'] mt-1">
              {p.periodStart.slice(0,10)} — {p.periodEnd.slice(0,10)}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-3 py-1 text-xs font-bold uppercase ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
            <a href={adminPayrollsApi.exportUrl(p.id)} className="flex items-center gap-1 px-3 py-1 border border-gray-600 text-gray-300 text-xs font-['DM_Sans'] hover:border-[#1D4ED8] hover:text-[#1D4ED8]">
              <Download size={12} /> Excel
            </a>
            {canAct && isDraft && (
              <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-bold uppercase font-['Barlow_Condensed'] disabled:opacity-50">
                <CheckCircle size={12} /> Aprobar
              </button>
            )}
            {canAct && isApproved && (
              <button onClick={() => setPayModal(true)} className="flex items-center gap-1 px-3 py-1 bg-[#1D4ED8] text-[#0D1B48] text-xs font-bold uppercase font-['Barlow_Condensed']">
                <DollarSign size={12} /> Registrar Pago
              </button>
            )}
            {isAdmin && !isVoided && (
              <button onClick={() => setVoidModal(true)} className="flex items-center gap-1 px-3 py-1 border border-red-400 text-red-400 text-xs font-bold uppercase font-['Barlow_Condensed']">
                <XCircle size={12} /> Anular
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="px-4 md:px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Bruto',      value: p.totalGross },
          { label: 'Total Deducciones', value: p.totalDeductions },
          { label: 'Total Neto',       value: p.totalNet },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-['DM_Sans'] uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold font-['Space_Mono'] text-gray-900 mt-1">RD$ {fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Líneas */}
      <div className="px-4 md:px-6 pb-8">
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-[#0D1B48]">
                {['#','Empleado','Salario Base','Beneficios','Bruto','AFP','TSS','ISR','Otros Desc.','Neto'].map((h) => (
                  <th key={h} className="text-left px-3 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.1em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(p.lines ?? []).map((line) => (
                <tr key={line.id} className="border-t border-gray-100">
                  <td className="px-3 py-3 font-['Space_Mono'] text-gray-400 text-xs">{line.lineNumber}</td>
                  <td className="px-3 py-3 font-['DM_Sans'] font-medium">{line.employee?.name}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs">{fmt(line.baseSalary)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs">{fmt(line.benefitsTotal)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs font-bold">{fmt(line.grossAmount)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs text-red-600">{fmt(line.afpEmployee)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs text-red-600">{fmt(line.tssEmployee)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs text-red-600">{fmt(line.isr)}</td>
                  <td className="px-3 py-3">
                    {isDraft && canAct ? (
                      <input
                        type="number" min="0" step="0.01"
                        defaultValue={line.otherDeductions}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val !== line.otherDeductions) {
                            updateLineMut.mutate({ lineId: line.id, d: { otherDeductions: val, otherDeductionsNote: line.otherDeductionsNote } });
                          }
                        }}
                        className="w-24 border border-gray-200 px-2 py-1 text-xs font-['Space_Mono'] focus:outline-none focus:border-[#1D4ED8]"
                      />
                    ) : (
                      <span className="font-['Space_Mono'] text-xs text-red-600">{fmt(line.otherDeductions)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs font-bold text-green-700">{fmt(line.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pago */}
      {payModal && (
        <FormModal title="Registrar Pago" onClose={() => setPayModal(false)}>
          <form onSubmit={onPaySubmit} className="p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Método de pago</label>
              <select name="paymentMethod" className={inputCls}>
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
                <option value="CHECK">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Fecha de pago</label>
              <input name="paymentDate" type="date" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Banco</label>
              <input name="paymentBank" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Referencia</label>
              <input name="paymentReference" className={inputCls} />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setPayModal(false)}
                className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] border border-gray-200 text-gray-600 hover:border-gray-400">
                Cancelar
              </button>
              <button type="submit" disabled={payMut.isPending}
                className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] bg-[#1D4ED8] text-[#0D1B48] disabled:opacity-50">
                {payMut.isPending ? 'Guardando…' : 'Registrar Pago'}
              </button>
            </div>
          </form>
        </FormModal>
      )}

      {/* Modal anular */}
      {voidModal && (
        <FormModal title="Anular Nómina" onClose={() => setVoidModal(false)}>
          <form onSubmit={onVoidSubmit} className="p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Motivo de anulación</label>
              <textarea name="voidReason" required rows={3} minLength={5} className={inputCls} />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setVoidModal(false)}
                className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] border border-gray-200 text-gray-600 hover:border-gray-400">
                Cancelar
              </button>
              <button type="submit" disabled={voidMut.isPending}
                className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] bg-red-600 text-white disabled:opacity-50">
                {voidMut.isPending ? 'Anulando…' : 'Confirmar Anulación'}
              </button>
            </div>
          </form>
        </FormModal>
      )}
    </div>
  );
}
