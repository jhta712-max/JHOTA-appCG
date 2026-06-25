import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Trash2, CheckCircle, DollarSign, Ban,
  Download, Plus, X, Save, Wallet, AlertTriangle, Receipt, FileText, ArrowRight, Link2,
} from 'lucide-react';
import { TransferPaymentForm, type TransferPaymentValue } from '../../components/shared/TransferPaymentForm';
import { payrollApi, paymentOrdersApi, type Payroll, type PayrollLine } from '../../api';
import { useRole } from '../../hooks/useRole';
import { PAYROLL_STATUS_LABEL as STATUS_LABEL, PAYROLL_STATUS_COLOR as STATUS_COLOR } from '../../utils/statusLabels';
import api from '../../api/client';
import { DetailPageSkeleton } from '../../components/ui/DetailPageSkeleton';
import { PAGE_META }           from '../../utils/routeMeta';

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
  const { canCreatePayroll, canApprovePayroll } = useRole();

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
  const [linkModal,  setLinkModal]  = useState(false);
  const [linkOrderId, setLinkOrderId] = useState('');

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
  const deleteMut     = useMutation({ mutationFn: () => payrollApi.delete(id!),                onSuccess: () => navigate('/payrolls'), onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al eliminar nómina') });
  const addLineMut    = useMutation({ mutationFn: (d: unknown) => payrollApi.addLine(id!, d),  onSuccess: () => { invalidate(); setAddingLine(false); setLineForm(emptyLine); }, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al agregar línea') });
  const updateLineMut = useMutation({ mutationFn: ({ lineId, d }: { lineId: string; d: unknown }) => payrollApi.updateLine(id!, lineId, d), onSuccess: () => { invalidate(); setEditLineId(null); }, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al actualizar línea') });
  const deleteLineMut   = useMutation({ mutationFn: (lineId: string) => payrollApi.deleteLine(id!, lineId), onSuccess: invalidate, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al eliminar línea') });
  const revertDraftMut    = useMutation({ mutationFn: () => payrollApi.revertToDraft(id!), onSuccess: invalidate, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al revertir') });
  const importOrdersMut   = useMutation({ mutationFn: () => payrollApi.importFromOrders(id!), onSuccess: invalidate, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al importar') });
  const recordPaymentMut  = useMutation({
    mutationFn: (lineId: string) => payrollApi.recordLinePayment(id!, lineId, paymentForm),
    onSuccess: () => { invalidate(); setPaymentLineId(null); setPaymentForm({ paymentBank: '', paymentReference: '', paidAt: '' }); },
    onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al registrar comprobante'),
  });
  const linkOrderMut = useMutation({
    mutationFn: (orderId: string) => paymentOrdersApi.linkPayroll(orderId, id!),
    onSuccess: () => { invalidate(); setLinkModal(false); setLinkOrderId(''); },
    onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al vincular orden de pago'),
  });

  // Órdenes de pago disponibles para vincular (tipo PAYROLL, sin nómina asignada)
  const { data: availableOrders } = useQuery({
    queryKey: ['payment-orders', 'available-link', payroll?.projectId],
    queryFn:  () => paymentOrdersApi.list({ orderType: 'PAYROLL', projectId: payroll!.projectId, limit: 50 }),
    select:   (r) => (r.data.data as any[]).filter((o) => !o.payroll),
    enabled:  !!payroll && linkModal,
  });

  if (isLoading) {
    const meta = PAGE_META['/payrolls'];
    return (
      <div>
        <div className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5" style={{ background: '#1C1C1C' }}>
          <div>
            <p
              className="text-xs uppercase tracking-widest mb-1"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218' }}
            >
              {meta.module}
            </p>
            <h1
              className="text-3xl md:text-5xl uppercase tracking-widest text-white leading-none"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              {meta.title}
            </h1>
          </div>
        </div>
        <div className="p-6">
          <DetailPageSkeleton sections={3} />
        </div>
      </div>
    );
  }
  if (!payroll)  return <div className="text-center py-16 text-red-500 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>Nómina no encontrada.</div>;

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
    <div className="space-y-5 max-w-5xl" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Back */}
      <Link to="/payrolls" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1C1C1C] transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
        <ArrowLeft className="w-4 h-4" /> Volver a nóminas
      </Link>

      {/* Header card */}
      <div className="overflow-hidden border border-gray-200 shadow-sm">
        {/* Dark hero band */}
        <div className="px-4 md:px-6 py-4 md:py-5" style={{ background: '#1C1C1C' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218' }}>
                NÓMINA
              </p>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-bold text-2xl text-white" style={{ fontFamily: 'Space Mono, monospace' }}>
                  NOM-{String(payroll.number).padStart(3, '0')}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLOR[payroll.status]}`}>
                  {STATUS_LABEL[payroll.status]}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {TYPE_LABEL[payroll.type]}
                </span>
              </div>
              <h1 className="text-2xl uppercase tracking-wide text-white mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                {payroll.description}
              </h1>
              <p className="text-sm font-bold" style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}>
                {payroll.project.code}
                <span className="font-normal text-gray-400 ml-1">— {payroll.project.name}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-widest uppercase text-gray-500 mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>TOTAL</p>
              <p className="font-bold text-3xl text-white" style={{ fontFamily: 'Space Mono, monospace' }}>
                RD$ {Number(payroll.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                {payroll.lines?.length ?? 0} línea(s)
              </p>
            </div>
          </div>
        </div>

        {/* White meta section */}
        <div className="bg-white px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Período</p>
              <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
                {payroll.periodStart.slice(0,10)} → {payroll.periodEnd.slice(0,10)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Creado por</p>
              <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>{payroll.createdBy.name}</p>
            </div>
            {payroll.approvedBy && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Aprobado por</p>
                <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>{payroll.approvedBy.name}</p>
              </div>
            )}
            {payroll.paidAt && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Pagado el</p>
                <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>
                  {(payroll.paymentDate ?? payroll.paidAt).slice(0, 10)}
                </p>
              </div>
            )}
            {payroll.paymentMethod && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Forma de pago</p>
                <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {payroll.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia'}
                </p>
              </div>
            )}
            {payroll.voidReason && (
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Razón de anulación</p>
                <p className="font-medium text-red-600 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>{payroll.voidReason}</p>
              </div>
            )}
          </div>

          {payroll.notes && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Notas</p>
              <p className="text-sm text-gray-600" style={{ fontFamily: 'DM Sans, sans-serif' }}>{payroll.notes}</p>
            </div>
          )}

          {/* Detalles de pago */}
          {payroll.status === 'PAID' && (payroll.paymentBank || payroll.paymentReference || payroll.receiptNumber || payroll.receivedBy) && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="border-l-4 bg-yellow-50 p-3 rounded-r-lg" style={{ borderLeftColor: '#F5C218' }}>
                <p className="text-xs font-semibold text-yellow-800 mb-2 flex items-center gap-1.5 uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  <Wallet className="w-3.5 h-3.5" /> Detalle del pago
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {payroll.paymentBank && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Banco</p>
                      <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>{payroll.paymentBank}</p>
                    </div>
                  )}
                  {payroll.paymentReference && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>No. Transacción</p>
                      <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>{payroll.paymentReference}</p>
                    </div>
                  )}
                  {payroll.receiptNumber && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>No. de Recibo</p>
                      <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'Space Mono, monospace' }}>{payroll.receiptNumber}</p>
                    </div>
                  )}
                  {payroll.receivedBy && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Recibido por</p>
                      <p className="font-medium text-gray-700 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>{payroll.receivedBy}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Orden de pago vinculada */}
          {payroll.paymentOrder && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="border-l-4 border-indigo-400 bg-indigo-50 p-3 rounded-r-lg">
                <p className="text-xs font-semibold text-indigo-700 mb-1.5 flex items-center gap-1.5 uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  <Link2 className="w-3.5 h-3.5" /> Orden de pago vinculada
                </p>
                <Link to={`/payment-orders/${payroll.paymentOrder.id}`}
                  className="flex items-center justify-between text-sm text-gray-700 hover:text-indigo-700 py-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <span className="truncate">{payroll.paymentOrder.concept}</span>
                  <span className="ml-3 shrink-0 font-semibold" style={{ fontFamily: 'Space Mono, monospace' }}>
                    RD$ {Number(payroll.paymentOrder.amount).toLocaleString('es-DO')}
                  </span>
                </Link>
              </div>
            </div>
          )}

          {payroll.expense && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="border-l-4 border-green-400 bg-green-50 p-3 rounded-r-lg flex items-center gap-2 text-sm text-gray-600" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                <Receipt className="w-4 h-4 text-green-500 shrink-0" />
                Gasto vinculado auto-creado:
                <Link to={`/expenses/${payroll.expense.id}`} className="text-blue-600 hover:underline font-medium">
                  RD$ {Number(payroll.expense.amount).toLocaleString('es-DO')} — ver gasto
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guía de flujo */}
      {isDraft && (
        <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2 rounded-r-lg" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-semibold">Nómina en borrador.</span>
            {' '}Flujo:{' '}
            <span className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">Vincular orden de pago</span>
            {' '}<ArrowRight className="inline w-3 h-3" />{' '}
            <span className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">Importar líneas</span>
            {' '}<ArrowRight className="inline w-3 h-3" />{' '}
            <span className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">Aprobar</span>
            {' '}<ArrowRight className="inline w-3 h-3" />{' '}
            <span className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">Exportar</span>
          </div>
        </div>
      )}
      {isApproved && (
        <div className="border-l-4 border-green-400 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center justify-between gap-3 rounded-r-lg" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <span><span className="font-semibold">Nómina aprobada.</span> Puedes exportarla en Excel o Word.</span>
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="border-l-4 border-red-400 bg-red-50 text-red-700 p-3 rounded-r-lg flex items-start gap-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="text-sm">{actionError}</span>
          <button onClick={() => setActionError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Action buttons */}
      {(canCreatePayroll || canApprovePayroll) && (
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              {canCreatePayroll && (
                <Link to={`/payrolls/${id}/edit`}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <Pencil className="w-4 h-4" /> Editar
                </Link>
              )}
              {canApprovePayroll && (
                <button
                  onClick={() => { setActionError(''); approveMut.mutate(); }}
                  disabled={approveMut.isPending || (payroll.lines?.length ?? 0) === 0}
                  className="flex items-center gap-1.5 px-4 py-2 font-bold uppercase tracking-wide rounded-lg disabled:opacity-50 transition-opacity"
                  style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.875rem' }}>
                  <CheckCircle className="w-4 h-4" />
                  {approveMut.isPending ? 'Aprobando…' : 'Aprobar'}
                </button>
              )}
              {canCreatePayroll && (
                <button
                  onClick={() => { setActionError(''); setLinkModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <Link2 className="w-4 h-4" /> Vincular orden de pago
                </button>
              )}
              {canApprovePayroll && (
                <button
                  onClick={() => { if (window.confirm('¿Eliminar esta nómina borrador?')) deleteMut.mutate(); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              )}
            </>
          )}
          {isApproved && canApprovePayroll && (
            <>
              <button
                onClick={() => { setActionError(''); setPayModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 font-bold uppercase tracking-wide rounded-lg transition-opacity"
                style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.875rem' }}>
                <DollarSign className="w-4 h-4" /> Marcar como Pagada
              </button>
              <button
                onClick={() => { if (window.confirm('¿Revertir esta nómina a Borrador? Podrás editar sus líneas nuevamente.')) revertDraftMut.mutate(); }}
                disabled={revertDraftMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                ↩ Revertir a Borrador
              </button>
              <button
                onClick={() => setVoidModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                <Ban className="w-4 h-4" /> Anular
              </button>
            </>
          )}
          {isPaid && !isVoided && canApprovePayroll && (
            <button onClick={() => setVoidModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              <Ban className="w-4 h-4" /> Anular
            </button>
          )}
          {/* Export buttons */}
          {!isVoided && (
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => handleExport('xlsx')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                <Download className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={() => handleExport('docx')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                <FileText className="w-4 h-4" /> Word
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lines table */}
      <div className="overflow-hidden border border-gray-200 shadow-sm">
        {/* Dark section header */}
        <div className="px-4 md:px-5 py-3 flex items-center justify-between" style={{ background: '#1C1C1C' }}>
          <h2 className="font-bold uppercase tracking-widest text-white flex items-center gap-2 text-sm" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            <Wallet className="w-4 h-4" style={{ color: '#F5C218' }} />
            Líneas de nómina
            <span className="text-gray-400 text-xs font-normal normal-case tracking-normal" style={{ fontFamily: 'Space Mono, monospace' }}>
              ({payroll.lines?.length ?? 0})
            </span>
          </h2>
          {isDraft && canCreatePayroll && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (confirm('¿Importar automáticamente las líneas desde las órdenes de pago vinculadas a esta nómina?'))
                    importOrdersMut.mutate();
                }}
                disabled={importOrdersMut.isPending}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border border-blue-700 text-blue-300 hover:bg-blue-900/30 transition-colors"
                style={{ background: 'rgba(30, 58, 138, 0.2)' }}>
                📥 {importOrdersMut.isPending ? 'Importando...' : 'Importar desde órdenes'}
              </button>
              <button
                onClick={() => { setAddingLine(true); setActionError(''); }}
                className="hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 font-bold uppercase tracking-wide transition-opacity hover:opacity-90"
                style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif' }}>
                <Plus className="w-3.5 h-3.5" /> Agregar línea
              </button>
            </div>
          )}
        </div>

        {/* Mobile cards for lines */}
        <div className="md:hidden divide-y divide-gray-100">
          {(payroll.lines ?? []).map((line) => (
            <div key={line.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-gray-800 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {line.supplierName || <span className="text-gray-400">Sin suplidor</span>}
                </p>
                <span className="text-xs text-gray-400 shrink-0" style={{ fontFamily: 'Space Mono, monospace' }}>
                  #{line.lineNumber}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>{line.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {Number(line.quantity).toLocaleString('es-DO', { maximumFractionDigits: 3 })} {line.unit} × RD$ {Number(line.unitPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
                <span className="font-bold text-sm" style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C' }}>
                  RD$ {Number(line.subtotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {(line.bankName || line.bankAccount) && (
                <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {line.bankName}{line.bankName && line.bankAccount ? ' · ' : ''}{line.bankAccount}
                </p>
              )}
              {(isPaid || isApproved) && (
                <div className="mt-2 flex items-center gap-2">
                  {line.paymentBank
                    ? <span className="text-xs text-green-700 font-medium" style={{ fontFamily: 'DM Sans, sans-serif' }}>{line.paymentBank}</span>
                    : <span className="text-xs text-gray-300">comprobante pendiente</span>
                  }
                </div>
              )}
              {(isDraft || isApproved) && canCreatePayroll && (
                <div className="flex gap-2 mt-2">
                  {isDraft && (
                    <button
                      onClick={() => openEdit(line)}
                      className="p-1.5 border border-gray-200 hover:bg-yellow-50 text-gray-500 hover:text-yellow-700"
                    ><Pencil className="w-3.5 h-3.5" /></button>
                  )}
                  <button
                    onClick={() => { if (window.confirm('¿Eliminar línea?')) deleteLineMut.mutate(line.id); }}
                    className="p-1.5 border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-600"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
          {(payroll.lines ?? []).length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>No hay líneas registradas.</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr style={{ background: '#1C1C1C' }}>
                <th className="px-3 py-2.5 text-left w-8 uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>#</th>
                <th className="px-3 py-2.5 text-left w-36 uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Nombre Suplidor</th>
                <th className="px-3 py-2.5 text-left uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Concepto de Servicio</th>
                <th className="px-3 py-2.5 text-center w-16 uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Unidad</th>
                <th className="px-3 py-2.5 text-right w-20 uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Cantidad</th>
                <th className="px-3 py-2.5 text-right w-24 uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Precio Unit.</th>
                <th className="px-3 py-2.5 text-right w-28 uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Monto a Pagar</th>
                <th className="px-3 py-2.5 text-left w-28 uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Banco</th>
                <th className="px-3 py-2.5 text-left w-36 uppercase tracking-wide text-gray-300" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>No. Cuenta</th>
                {(isPaid || isApproved) && <th className="px-3 py-2.5 text-left w-32 uppercase tracking-wide text-green-400" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Banco Origen</th>}
                {(isPaid || isApproved) && <th className="px-3 py-2.5 text-left w-36 uppercase tracking-wide text-green-400" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>No. Transacción</th>}
                {(isPaid || isApproved) && <th className="px-3 py-2.5 text-left w-24 uppercase tracking-wide text-green-400" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem' }}>Fecha Pago</th>}
                {(isPaid || isApproved) && <th className="px-3 py-2.5 w-10"></th>}
                {(isDraft || isApproved) && <th className="px-3 py-2.5 w-16"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(payroll.lines ?? []).map((line, idx) => (
                editLineId === line.id ? (
                  /* ── Edit row ── */
                  <tr key={line.id} style={{ background: '#fffbf0' }}>
                    <td className="px-3 py-1.5 text-gray-400 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>{line.lineNumber}</td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="Suplidor"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'DM Sans, sans-serif' }}
                        value={editLineForm.supplierName}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, supplierName: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="Concepto"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'DM Sans, sans-serif' }}
                        value={editLineForm.description}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        className="w-full border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'DM Sans, sans-serif' }}
                        value={editLineForm.unit}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, unit: e.target.value }))}
                      >
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" step="0.001"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'Space Mono, monospace' }}
                        value={editLineForm.quantity}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, quantity: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min="0" step="0.01"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'Space Mono, monospace' }}
                        value={editLineForm.unitPrice}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, unitPrice: e.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gray-700 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
                      RD$ {(parseFloat(editLineForm.quantity || '0') * parseFloat(editLineForm.unitPrice || '0')).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="Banco"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'DM Sans, sans-serif' }}
                        value={editLineForm.bankName}
                        onChange={(e) => setEditLineForm((f) => ({ ...f, bankName: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="No. cuenta"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'Space Mono, monospace' }}
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
                  <tr key={line.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}>
                    <td className="px-3 py-2.5 text-gray-400 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>{line.lineNumber}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-800 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>{line.supplierName || <span className="text-gray-400">—</span>}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-800 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>{line.description}</p>
                      {line.notes && <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>{line.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-500" style={{ fontFamily: 'DM Sans, sans-serif' }}>{line.unit}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>
                      {Number(line.quantity).toLocaleString('es-DO', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>
                      RD$ {Number(line.unitPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>
                      RD$ {Number(line.subtotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                      {line.bankName || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>
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
                            ? <span className="text-green-700 font-medium" style={{ fontFamily: 'DM Sans, sans-serif' }}>{line.paymentBank}</span>
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
                            ? <span className="text-green-700 font-medium" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>{line.paymentReference}</span>
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
                            ? <span className="text-green-700" style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>{new Date(line.paidAt).toLocaleDateString('es-DO', { timeZone: 'UTC' })}</span>
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
                <tr style={{ background: '#fffbf0', borderTop: '2px solid #F5C218' }}>
                  <td className="px-3 py-1.5 text-gray-400 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>+</td>
                  <td className="px-2 py-1">
                    <input placeholder="Nombre suplidor"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'DM Sans, sans-serif' }}
                      value={lineForm.supplierName}
                      onChange={(e) => setLineForm((f) => ({ ...f, supplierName: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input placeholder="Concepto del servicio"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'DM Sans, sans-serif' }}
                      value={lineForm.description}
                      onChange={(e) => setLineForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select className="w-full border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'DM Sans, sans-serif' }}
                      value={lineForm.unit}
                      onChange={(e) => setLineForm((f) => ({ ...f, unit: e.target.value }))}
                    >
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.001" placeholder="0"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'Space Mono, monospace' }}
                      value={lineForm.quantity}
                      onChange={(e) => setLineForm((f) => ({ ...f, quantity: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.01" placeholder="0.00"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'Space Mono, monospace' }}
                      value={lineForm.unitPrice}
                      onChange={(e) => setLineForm((f) => ({ ...f, unitPrice: e.target.value }))}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-gray-700 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
                    RD$ {(parseFloat(lineForm.quantity || '0') * parseFloat(lineForm.unitPrice || '0')).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1">
                    <input placeholder="Banco"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'DM Sans, sans-serif' }}
                      value={lineForm.bankName}
                      onChange={(e) => setLineForm((f) => ({ ...f, bankName: e.target.value }))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input placeholder="No. cuenta"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ fontFamily: 'Space Mono, monospace' }}
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
              <tr style={{ background: '#1C1C1C', borderTop: '2px solid #333' }}>
                <td colSpan={isDraft ? FIXED_COLS : FIXED_COLS - 1} className="px-5 py-3 text-right font-bold uppercase tracking-widest text-white" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  TOTAL A PAGAR
                </td>
                <td className="px-5 py-3 text-right font-bold whitespace-nowrap" style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.1rem', color: '#F5C218' }}>
                  RD$ {Number(payroll.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </td>
                {(isDraft || isApproved) && <td style={{ background: '#1C1C1C' }} />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md shadow-2xl overflow-hidden" style={{ borderRadius: '0' }}>
            {/* Dark modal header */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#1C1C1C' }}>
              <DollarSign className="w-5 h-5" style={{ color: '#F5C218' }} />
              <h3 className="font-bold uppercase tracking-widest text-white" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>
                Registrar pago
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                Complete los datos del pago para marcar la nómina como pagada.
              </p>

              <TransferPaymentForm
                value={payForm as TransferPaymentValue}
                onChange={(next) => setPayForm((f) => ({ ...f, ...next }))}
                showMethodSelector={true}
                showCash={true}
              />

              {/* Validación visual para efectivo */}
              {payForm.paymentMethod === 'CASH' && (!payForm.receiptNumber.trim() || !payForm.receivedBy.trim()) && (
                <p className="text-xs text-amber-600 mb-2 flex items-center gap-1.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Complete el número de recibo y el nombre para confirmar el pago en efectivo.
                </p>
              )}

              <div className="flex gap-2 mt-4">
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
                  className="flex-1 py-2.5 font-bold uppercase tracking-wide disabled:opacity-50 transition-opacity"
                  style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {payMut.isPending ? 'Guardando…' : 'Confirmar pago'}
                </button>
                <button
                  onClick={() => setPayModal(false)}
                  className="px-4 py-2.5 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors rounded" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal vincular orden de pago */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md shadow-2xl overflow-hidden" style={{ borderRadius: '0' }}>
            {/* Dark modal header */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#1C1C1C' }}>
              <Link2 className="w-5 h-5" style={{ color: '#F5C218' }} />
              <h3 className="font-bold uppercase tracking-widest text-white" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>
                Vincular Orden de Pago
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                Selecciona la orden de pago de tipo Nómina que corresponde a esta nómina.
              </p>
              {(availableOrders ?? []).length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  No hay órdenes de pago de tipo Nómina pendientes de vincular en este proyecto.
                </div>
              ) : (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {(availableOrders ?? []).map((o: any) => (
                    <label key={o.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        linkOrderId === o.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'
                      }`}>
                      <input type="radio" name="linkOrder" value={o.id}
                        checked={linkOrderId === o.id}
                        onChange={() => setLinkOrderId(o.id)}
                        className="accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" style={{ fontFamily: 'DM Sans, sans-serif' }}>{o.concept}</p>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>{o.supplier?.name ?? o.payingCompany}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 shrink-0" style={{ fontFamily: 'Space Mono, monospace' }}>
                        RD$ {Number(o.amount).toLocaleString('es-DO')}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => linkOrderMut.mutate(linkOrderId)}
                  disabled={!linkOrderId || linkOrderMut.isPending}
                  className="flex-1 py-2.5 font-bold uppercase tracking-wide disabled:opacity-50 transition-opacity"
                  style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {linkOrderMut.isPending ? 'Vinculando…' : 'Vincular'}
                </button>
                <button
                  onClick={() => { setLinkModal(false); setLinkOrderId(''); }}
                  className="px-4 py-2.5 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors rounded" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md shadow-2xl overflow-hidden" style={{ borderRadius: '0' }}>
            {/* Dark modal header */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#1C1C1C' }}>
              <Ban className="w-5 h-5 text-red-400" />
              <h3 className="font-bold uppercase tracking-widest text-white" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>
                Anular nómina
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                Esta acción anulará la nómina y el gasto vinculado. No se puede deshacer.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>Razón de anulación *</label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" style={{ fontFamily: 'DM Sans, sans-serif' }}
                placeholder="Explique el motivo de la anulación…"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => voidMut.mutate()}
                  disabled={voidReason.trim().length < 5 || voidMut.isPending}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {voidMut.isPending ? 'Anulando…' : 'Confirmar anulación'}
                </button>
                <button
                  onClick={() => { setVoidModal(false); setVoidReason(''); }}
                  className="flex-1 py-2.5 text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 rounded transition-colors" style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
