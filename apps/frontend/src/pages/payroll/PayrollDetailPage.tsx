import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Trash2, CheckCircle, DollarSign, Ban,
  Download, Plus, X, Save, Wallet, AlertTriangle, Receipt, FileText,
} from 'lucide-react';
import { payrollApi, type Payroll, type PayrollLine } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import api from '../../api/client';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-yellow-100 text-yellow-800 border-yellow-300',
  APPROVED: 'bg-blue-100 text-blue-800 border-blue-300',
  PAID:     'bg-green-100 text-green-800 border-green-300',
  VOIDED:   'bg-red-100 text-red-800 border-red-300',
};
const TYPE_LABEL: Record<string, string> = { LABOR: 'Mano de obra', SERVICE: 'Servicios' };

interface LineForm {
  description:  string;
  quantity:     string;
  unit:         string;
  unitPrice:    string;
  notes:        string;
  supplierName: string;
  bankName:     string;
  bankAccount:  string;
}
const emptyLine: LineForm = {
  description: '', quantity: '', unit: 'Días', unitPrice: '', notes: '',
  supplierName: '', bankName: '', bankAccount: '',
};
const UNITS = ['Días', 'Hrs', 'Sem', 'PA', 'Glb', 'm²', 'm³', 'm', 'Und', 'Viaje', 'Servicio'];

export default function PayrollDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const user      = useAuthStore((s) => s.user);
  const isAdmin   = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

  const [voidModal, setVoidModal]       = useState(false);
  const [voidReason, setVoidReason]     = useState('');
  const [payModal, setPayModal]         = useState(false);
  const [payForm, setPayForm]           = useState({
    paymentMethod:    'TRANSFER' as 'CASH' | 'TRANSFER',
    paymentDate:      new Date().toISOString().slice(0, 10),
    paymentBank:      '',
    paymentReference: '',
    receiptNumber:    '',
    receivedBy:       '',
  });
  const [addingLine, setAddingLine]     = useState(false);
  const [lineForm, setLineForm]         = useState<LineForm>(emptyLine);
  const [editLineId, setEditLineId]     = useState<string | null>(null);
  const [editLineForm, setEditLineForm] = useState<LineForm>(emptyLine);
  const [actionError, setActionError]   = useState('');
  const [paymentLineId, setPaymentLineId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm]     = useState({ paymentBank: '', paymentReference: '', paidAt: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', id],
    queryFn:  () => payrollApi.getById(id!).then((r) => r.data.data),
  });

  const payroll: Payroll | undefined = data;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payroll', id] });
    qc.invalidateQueries({ queryKey: ['payrolls'] });
  };

  const approveMut    = useMutation({ mutationFn: () => payrollApi.approve(id!),               onSuccess: invalidate, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al aprobar') });
  const payMut        = useMutation({ mutationFn: (d: unknown) => payrollApi.pay(id!, d),      onSuccess: () => { invalidate(); setPayModal(false); }, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al marcar pagada') });
  const voidMut       = useMutation({ mutationFn: () => payrollApi.void(id!, voidReason),      onSuccess: () => { invalidate(); setVoidModal(false); setVoidReason(''); }, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al anular') });
  const deleteMut     = useMutation({ mutationFn: () => payrollApi.delete(id!),                onSuccess: () => navigate('/payrolls') });
  const addLineMut    = useMutation({ mutationFn: (d: unknown) => payrollApi.addLine(id!, d),  onSuccess: () => { invalidate(); setAddingLine(false); setLineForm(emptyLine); }, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al agregar línea') });
  const updateLineMut = useMutation({ mutationFn: ({ lineId, d }: { lineId: string; d: unknown }) => payrollApi.updateLine(id!, lineId, d), onSuccess: () => { invalidate(); setEditLineId(null); }, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al actualizar línea') });
  const deleteLineMut   = useMutation({ mutationFn: (lineId: string) => payrollApi.deleteLine(id!, lineId), onSuccess: invalidate });
  const revertDraftMut    = useMutation({ mutationFn: () => payrollApi.revertToDraft(id!), onSuccess: invalidate, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al revertir') });
  const recordPaymentMut  = useMutation({
    mutationFn: (lineId: string) => payrollApi.recordLinePayment(id!, lineId, paymentForm),
    onSuccess: () => { invalidate(); setPaymentLineId(null); setPaymentForm({ paymentBank: '', paymentReference: '', paidAt: '' }); },
    onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al registrar comprobante'),
  });

  if (isLoading) return <div className="text-center py-16 text-gray-400 text-sm">Cargando nómina…</div>;
  if (!payroll)  return <div className="text-center py-16 text-red-500 text-sm">Nómina no encontrada.</div>;

  const isDraft    = payroll.status === 'DRAFT';
  const isApproved = payroll.status === 'APPROVED';
  const isVoided   = payroll.status === 'VOIDED';
  const isPaid     = payroll.status === 'PAID';

  function submitLine(form: LineForm) {
    return {
      description:  form.description,
      quantity:     parseFloat(form.quantity),
      unit:         form.unit,
      unitPrice:    parseFloat(form.unitPrice),
      notes:        form.notes        || undefined,
      supplierName: form.supplierName || undefined,
      bankName:     form.bankName     || undefined,
      bankAccount:  form.bankAccount  || undefined,
    };
  }

  function openEdit(line: PayrollLine) {
    setEditLineId(line.id);
    setEditLineForm({
      description:  line.description,
      quantity:     String(line.quantity),
      unit:         line.unit,
      unitPrice:    String(line.unitPrice),
      notes:        line.notes        ?? '',
      supplierName: line.supplierName ?? '',
      bankName:     line.bankName     ?? '',
      bankAccount:  line.bankAccount  ?? '',
    });
  }

  function handleExport(format: 'xlsx' | 'docx') {
    const token   = localStorage.getItem('accessToken') ?? '';
    const baseUrl = (api.defaults.baseURL ?? '').replace(/\/$/, '');
    const url     = `${baseUrl}/payrolls/${id}/export.${format}`;
    const ext     = format;
    const nom     = `nomina-${String(payroll!.number).padStart(3, '0')}.${ext}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a   = document.createElement('a');
        a.href    = URL.createObjectURL(blob);
        a.download = nom;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  // Column count for colSpan calculations
  // Cols: # | Suplidor | Concepto | Unidad | Cant | Precio | Monto | Banco | No.Cuenta | [actions?]
  const FIXED_COLS = (isPaid || isApproved) ? 12 : 9; // +3 columnas comprobante

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Back */}
      <Link to="/payrolls" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Volver a nóminas
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono font-bold text-lg text-gray-900">
                NOM-{String(payroll.number).padStart(3, '0')}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLOR[payroll.status]}`}>
                {STATUS_LABEL[payroll.status]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {TYPE_LABEL[payroll.type]}
              </span>
            </div>
            <h1 className="text-base font-semibold text-gray-800 mt-1">{payroll.description}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {payroll.project.code} — {payroll.project.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              RD$ {Number(payroll.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{payroll.lines?.length ?? 0} línea(s)</p>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Período</p>
            <p className="font-medium text-gray-700">{payroll.periodStart.slice(0,10)} → {payroll.periodEnd.slice(0,10)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Creado por</p>
            <p className="font-medium text-gray-700">{payroll.createdBy.name}</p>
          </div>
          {payroll.approvedBy && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Aprobado por</p>
              <p className="font-medium text-gray-700">{payroll.approvedBy.name}</p>
            </div>
          )}
          {payroll.paidAt && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Pagado el</p>
              <p className="font-medium text-gray-700">
                {(payroll.paymentDate ?? payroll.paidAt).slice(0, 10)}
              </p>
            </div>
          )}
          {payroll.paymentMethod && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Forma de pago</p>
              <p className="font-medium text-gray-700">
                {payroll.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia'}
              </p>
            </div>
          )}
          {payroll.voidReason && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400 mb-0.5">Razón de anulación</p>
              <p className="font-medium text-red-600">{payroll.voidReason}</p>
            </div>
          )}
        </div>

        {payroll.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-0.5">Notas</p>
            <p className="text-sm text-gray-600">{payroll.notes}</p>
          </div>
        )}

        {/* Detalles de pago */}
        {payroll.status === 'PAID' && (payroll.paymentBank || payroll.paymentReference || payroll.receiptNumber || payroll.receivedBy) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Detalle del pago
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {payroll.paymentBank && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Banco</p>
                  <p className="font-medium text-gray-700">{payroll.paymentBank}</p>
                </div>
              )}
              {payroll.paymentReference && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">No. Transacción</p>
                  <p className="font-medium text-gray-700 font-mono">{payroll.paymentReference}</p>
                </div>
              )}
              {payroll.receiptNumber && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">No. de Recibo</p>
                  <p className="font-medium text-gray-700 font-mono">{payroll.receiptNumber}</p>
                </div>
              )}
              {payroll.receivedBy && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Recibido por</p>
                  <p className="font-medium text-gray-700">{payroll.receivedBy}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {payroll.expense && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
            <Receipt className="w-4 h-4 text-green-500" />
            Gasto vinculado auto-creado:
            <Link to={`/expenses/${payroll.expense.id}`} className="text-blue-600 hover:underline font-medium">
              RD$ {Number(payroll.expense.amount).toLocaleString('es-DO')} — ver gasto
            </Link>
          </div>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Action buttons */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Link to={`/payrolls/${id}/edit`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                <Pencil className="w-4 h-4" /> Editar
              </Link>
              <button
                onClick={() => { setActionError(''); approveMut.mutate(); }}
                disabled={approveMut.isPending || (payroll.lines?.length ?? 0) === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                <CheckCircle className="w-4 h-4" />
                {approveMut.isPending ? 'Aprobando…' : 'Aprobar'}
              </button>
              <button
                onClick={() => { if (window.confirm('¿Eliminar esta nómina borrador?')) deleteMut.mutate(); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </>
          )}
          {isApproved && (
            <>
              <button
                onClick={() => { setActionError(''); setPayModal(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700">
                <DollarSign className="w-4 h-4" /> Marcar como Pagada
              </button>
              <button
                onClick={() => { if (window.confirm('¿Revertir esta nómina a Borrador? Podrás editar sus líneas nuevamente.')) revertDraftMut.mutate(); }}
                disabled={revertDraftMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-50">
                ↩ Revertir a Borrador
              </button>
              <button
                onClick={() => setVoidModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50">
                <Ban className="w-4 h-4" /> Anular
              </button>
            </>
          )}
          {isPaid && !isVoided && (
            <button onClick={() => setVoidModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50">
              <Ban className="w-4 h-4" /> Anular
            </button>
          )}
          {/* Export buttons */}
          {!isVoided && (
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => handleExport('xlsx')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                <Download className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={() => handleExport('docx')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                <FileText className="w-4 h-4" /> Word
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lines table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4" style={{ color: '#F5C218' }} />
            Líneas de nómina ({payroll.lines?.length ?? 0})
          </h2>
          {isDraft && (
            <button
              onClick={() => { setAddingLine(true); setActionError(''); }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-900 hover:opacity-90"
              style={{ background: '#F5C218' }}>
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-36">Nombre Suplidor</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Concepto de Servicio</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-16">Unidad</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-20">Cantidad</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-24">Precio Unit.</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-28">Monto a Pagar</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-28">Banco</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-36">No. Cuenta</th>
                {(isPaid || isApproved) && <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 w-32">Banco Origen</th>}
                {(isPaid || isApproved) && <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 w-36">No. Transacción</th>}
                {(isPaid || isApproved) && <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 w-24">Fecha Pago</th>}
                {(isPaid || isApproved) && <th className="px-3 py-2.5 w-10"></th>}
                {(isDraft || isApproved) && <th className="px-3 py-2.5 w-16"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(payroll.lines ?? []).map((line, idx) => (
                editLineId === line.id ? (
                  /* ── Edit row ── */
                  <tr key={line.id} className="bg-yellow-50">
                    <td className="px-3 py-1.5 text-gray-400 text-xs">{line.lineNumber}</td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="Suplidor"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        value={editLineForm.supplierName}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, supplierName: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="Concepto"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        value={editLineForm.description}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        className="w-full border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        value={editLineForm.unit}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, unit: e.target.value }))}
                      >
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" step="0.001"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        value={editLineForm.quantity}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, quantity: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" step="0.01"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        value={editLineForm.unitPrice}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, unitPrice: e.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gray-700 text-xs">
                      RD$ {(parseFloat(editLineForm.quantity || '0') * parseFloat(editLineForm.unitPrice || '0')).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="Banco"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        value={editLineForm.bankName}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, bankName: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="No. cuenta"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        value={editLineForm.bankAccount}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, bankAccount: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateLineMut.mutate({ lineId: line.id, d: submitLine(editLineForm) })}
                          className="p-1.5 rounded text-white bg-blue-600 hover:bg-blue-700"
                        ><Save className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditLineId(null)} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* ── Display row ── */
                  <tr key={line.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{line.lineNumber}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-800 text-sm">{line.supplierName || <span className="text-gray-400">—</span>}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-800 text-sm">{line.description}</p>
                      {line.notes && <p className="text-xs text-gray-400 mt-0.5">{line.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-500">{line.unit}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {Number(line.quantity).toLocaleString('es-DO', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      RD$ {Number(line.unitPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                      RD$ {Number(line.subtotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">
                      {line.bankName || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">
                      {line.bankAccount || <span className="text-gray-400">—</span>}
                    </td>
                    {/* Columnas de comprobante — solo en PAID */}
                    {(isPaid || isApproved) && (
                      <td className="px-3 py-2.5 text-sm">
                        {paymentLineId === line.id ? (
                          <input className="w-full border border-green-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="Banco origen"
                            value={paymentForm.paymentBank}
                            onChange={(e) => setPaymentForm((f) => ({ ...f, paymentBank: e.target.value }))}
                          />
                        ) : (
                          line.paymentBank
                            ? <span className="text-green-700 font-medium">{line.paymentBank}</span>
                            : <span className="text-gray-300 text-xs">pendiente</span>
                        )}
                      </td>
                    )}
                    {(isPaid || isApproved) && (
                      <td className="px-3 py-2.5 text-sm">
                        {paymentLineId === line.id ? (
                          <input className="w-full border border-green-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="No. transacción"
                            value={paymentForm.paymentReference}
                            onChange={(e) => setPaymentForm((f) => ({ ...f, paymentReference: e.target.value }))}
                          />
                        ) : (
                          line.paymentReference
                            ? <span className="text-green-700 font-medium font-mono">{line.paymentReference}</span>
                            : <span className="text-gray-300 text-xs">pendiente</span>
                        )}
                      </td>
                    )}
                    {(isPaid || isApproved) && (
                      <td className="px-3 py-2.5 text-sm">
                        {paymentLineId === line.id ? (
                          <input type="date" className="w-full border border-green-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            value={paymentForm.paidAt}
                            onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))}
                          />
                        ) : (
                          line.paidAt
                            ? <span className="text-green-700">{new Date(line.paidAt).toLocaleDateString('es-DO')}</span>
                            : <span className="text-gray-300 text-xs">pendiente</span>
                        )}
                      </td>
                    )}
                    {(isPaid || isApproved) && (
                      <td className="px-2 py-2.5">
                        {paymentLineId === line.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => recordPaymentMut.mutate(line.id)}
                              disabled={recordPaymentMut.isPending}
                              className="p-1.5 rounded bg-green-600 text-white hover:bg-green-700 text-xs font-bold">✓</button>
                            <button onClick={() => setPaymentLineId(null)}
                              className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setPaymentLineId(line.id);
                              setPaymentForm({
                                paymentBank:      line.paymentBank ?? '',
                                paymentReference: line.paymentReference ?? '',
                                paidAt:           line.paidAt ? line.paidAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
                              });
                            }}
                            className="p-1.5 rounded border border-green-200 text-green-600 hover:bg-green-50"
                            title="Registrar comprobante"
                          >✎</button>
                        )}
                      </td>
                    )}
                    {(isDraft || isApproved) && (
                      <td className="px-2 py-2.5">
                        <div className="flex gap-1 justify-end">
                          {isDraft && <button
                            onClick={() => openEdit(line)}
                            className="p-1.5 rounded border border-gray-200 hover:bg-yellow-50 text-gray-500 hover:text-yellow-700"
                          ><Pencil className="w-3.5 h-3.5" /></button>}
                          <button
                            onClick={() => { if (window.confirm('¿Eliminar línea?')) deleteLineMut.mutate(line.id); }}
                            className="p-1.5 rounded border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-600"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}

              {/* Add line form row */}
              {addingLine && (
                <tr className="bg-yellow-50 border-t-2 border-yellow-300">
                  <td className="px-3 py-1.5 text-gray-400 text-xs">+</td>
                  <td className="px-2 py-1">
                    <input placeholder="Nombre suplidor"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      value={lineForm.supplierName}
                      onChange={(e) => setLineForm((f) => ({ ...f, supplierName: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input placeholder="Concepto del servicio"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      value={lineForm.description}
                      onChange={(e) => setLineForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select className="w-full border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      value={lineForm.unit}
                      onChange={(e) => setLineForm((f) => ({ ...f, unit: e.target.value }))}
                    >
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.001" placeholder="0"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      value={lineForm.quantity}
                      onChange={(e) => setLineForm((f) => ({ ...f, quantity: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.01" placeholder="0.00"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      value={lineForm.unitPrice}
                      onChange={(e) => setLineForm((f) => ({ ...f, unitPrice: e.target.value }))}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-gray-700 text-xs">
                    RD$ {(parseFloat(lineForm.quantity || '0') * parseFloat(lineForm.unitPrice || '0')).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1">
                    <input placeholder="Banco"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      value={lineForm.bankName}
                      onChange={(e) => setLineForm((f) => ({ ...f, bankName: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input placeholder="No. cuenta"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      value={lineForm.bankAccount}
                      onChange={(e) => setLineForm((f) => ({ ...f, bankAccount: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-1">
                      <button
                        onClick={() => addLineMut.mutate(submitLine(lineForm))}
                        disabled={!lineForm.description || !lineForm.quantity || !lineForm.unitPrice}
                        className="p-1.5 rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-40"
                      ><Save className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setAddingLine(false); setLineForm(emptyLine); }} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200" style={{ background: '#FFF8DC' }}>
                <td colSpan={isDraft ? FIXED_COLS : FIXED_COLS - 1} className="px-4 py-3 text-right font-bold text-gray-900">TOTAL A PAGAR</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 text-base whitespace-nowrap">
                  RD$ {Number(payroll.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </td>
                {(isDraft || isApproved) && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-bold text-gray-900 text-lg mb-1 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" /> Registrar pago
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Complete los datos del pago para marcar la nómina como pagada.
            </p>

            {/* Método de pago */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago *</label>
            <div className="flex gap-4 mb-4">
              {(['CASH', 'TRANSFER'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="payMethod" value={m}
                    checked={payForm.paymentMethod === m}
                    onChange={() => setPayForm((f) => ({ ...f, paymentMethod: m }))}
                    className="accent-yellow-500"
                  />
                  {m === 'CASH' ? 'Efectivo' : 'Transferencia bancaria'}
                </label>
              ))}
            </div>

            {/* Fecha de pago */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago *</label>
            <input type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              value={payForm.paymentDate}
              onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))}
            />

            {/* Banco y referencia — solo para transferencias */}
            {payForm.paymentMethod === 'TRANSFER' && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                <input type="text" placeholder="Ej: Banco Popular"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  value={payForm.paymentBank}
                  onChange={(e) => setPayForm((f) => ({ ...f, paymentBank: e.target.value }))}
                />
                <label className="block text-sm font-medium text-gray-700 mb-1">No. de transacción / referencia</label>
                <input type="text" placeholder="Ej: TRF-2026-001234"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  value={payForm.paymentReference}
                  onChange={(e) => setPayForm((f) => ({ ...f, paymentReference: e.target.value }))}
                />
              </>
            )}

            {/* Datos del recibo — solo para efectivo */}
            {payForm.paymentMethod === 'CASH' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" /> Datos del recibo de pago en efectivo (obligatorios)
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. de recibo *</label>
                <input type="text" placeholder="Ej: REC-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  value={payForm.receiptNumber}
                  onChange={(e) => setPayForm((f) => ({ ...f, receiptNumber: e.target.value }))}
                />
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de quien recibió el pago *</label>
                <input type="text" placeholder="Ej: Juan Pérez"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  value={payForm.receivedBy}
                  onChange={(e) => setPayForm((f) => ({ ...f, receivedBy: e.target.value }))}
                />
              </div>
            )}

            {/* Validación visual para efectivo */}
            {payForm.paymentMethod === 'CASH' && (!payForm.receiptNumber.trim() || !payForm.receivedBy.trim()) && (
              <p className="text-xs text-amber-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Complete el número de recibo y el nombre para confirmar el pago en efectivo.
              </p>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => payMut.mutate({
                  paymentMethod:    payForm.paymentMethod,
                  paymentDate:      payForm.paymentDate,
                  paymentBank:      payForm.paymentBank      || undefined,
                  paymentReference: payForm.paymentReference || undefined,
                  receiptNumber:    payForm.receiptNumber    || undefined,
                  receivedBy:       payForm.receivedBy       || undefined,
                })}
                disabled={
                  payMut.isPending ||
                  !payForm.paymentDate ||
                  (payForm.paymentMethod === 'CASH' && (!payForm.receiptNumber.trim() || !payForm.receivedBy.trim()))
                }
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                {payMut.isPending ? 'Guardando…' : 'Confirmar pago'}
              </button>
              <button
                onClick={() => setPayModal(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-bold text-gray-900 text-lg mb-1 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" /> Anular nómina
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Esta acción anulará la nómina y el gasto vinculado. No se puede deshacer.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Razón de anulación *</label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              placeholder="Explique el motivo de la anulación…"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => voidMut.mutate()}
                disabled={voidReason.trim().length < 5 || voidMut.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {voidMut.isPending ? 'Anulando…' : 'Confirmar anulación'}
              </button>
              <button
                onClick={() => { setVoidModal(false); setVoidReason(''); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
