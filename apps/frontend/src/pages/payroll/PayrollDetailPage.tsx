import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Trash2, CheckCircle, DollarSign, Ban,
  Download, Plus, X, Save, Wallet, AlertTriangle, Receipt, FileText, ArrowRight, Link2,
} from 'lucide-react';
import { payrollApi, paymentOrdersApi, contratosAjustadosApi, type Payroll, type PayrollLine } from '../../api';
import { useRole } from '../../hooks/useRole';
import api from '../../api/client';

const B = { dark: '#1C1C1C', yellow: '#F5C218', darkAlt: '#141414' } as const;
const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const BODY    = "'DM Sans', system-ui, sans-serif";
const MONO    = "'Space Mono', monospace";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:    { bg: 'rgba(245,194,24,0.15)', color: '#b08a00' },
  APPROVED: { bg: 'rgba(59,130,246,0.12)',  color: '#2563eb' },
  PAID:     { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' },
  VOIDED:   { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626' },
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
  contratoAjustadoId?: string | null;
}
const emptyLine: LineForm = {
  description: '', quantity: '', unit: 'Días', unitPrice: '', notes: '',
  supplierName: '', bankName: '', bankAccount: '', contratoAjustadoId: null,
};
const UNITS = ['Días', 'Hrs', 'Sem', 'PA', 'Glb', 'm²', 'm³', 'm', 'Und', 'Viaje', 'Servicio'];

// Small reusable input style for table cells
const cellInput: React.CSSProperties = {
  width: '100%', border: '1px solid #d1d5db', borderRadius: '5px',
  padding: '0.3rem 0.5rem', fontSize: '0.75rem', fontFamily: BODY, outline: 'none',
  background: '#fff',
};

export default function PayrollDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { canCreatePayroll, canApprovePayroll, isAdmin } = useRole();

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
  const [editContratoLineId, setEditContratoLineId] = useState<string | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null);

  useEffect(() => {
    if (!document.querySelector('[data-smi-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=Space+Mono:wght@400;700&display=swap';
      link.setAttribute('data-smi-fonts', '1');
      document.head.appendChild(link);
    }
  }, []);

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
  const revertApprovedMut = useMutation({ mutationFn: () => payrollApi.revertToApproved(id!), onSuccess: invalidate, onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al revertir') });
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

  const updateLineContratoMut = useMutation({
    mutationFn: ({ lineId, contratoAjustadoId }: { lineId: string; contratoAjustadoId: string | null }) =>
      payrollApi.updateLineContratoAjustado(id!, lineId, contratoAjustadoId),
    onSuccess: () => { invalidate(); setEditContratoLineId(null); setSelectedContratoId(null); },
    onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al actualizar contrato'),
  });

  const { data: availableOrders } = useQuery({
    queryKey: ['payment-orders', 'available-link', payroll?.projectId],
    queryFn:  () => paymentOrdersApi.list({ orderType: 'PAYROLL', projectId: payroll!.projectId, limit: 50 }),
    select:   (r) => (r.data.data as any[]).filter((o) => !o.payroll),
    enabled:  !!payroll && linkModal,
  });

  const { data: projectContratos } = useQuery({
    queryKey: ['contratos-ajustados', 'project', payroll?.projectId],
    queryFn:  () => contratosAjustadosApi.list({ projectId: payroll!.projectId, limit: 100 }),
    select:   (r) => (r.data?.data as any[]) ?? [],
    enabled:  !!payroll,
  });

  if (isLoading) return (
    <div style={{ textAlign: 'center', padding: '4rem 0', fontFamily: MONO, fontSize: '0.72rem',
                   color: '#9ca3af', letterSpacing: '0.08em' }}>
      CARGANDO NÓMINA…
    </div>
  );
  if (!payroll) return (
    <div style={{ textAlign: 'center', padding: '4rem 0', fontFamily: BODY, color: '#ef4444' }}>
      Nómina no encontrada.
    </div>
  );

  const isDraft    = payroll.status === 'DRAFT';
  const isApproved = payroll.status === 'APPROVED';
  const isVoided   = payroll.status === 'VOIDED';
  const isPaid     = payroll.status === 'PAID';
  const ss         = STATUS_STYLE[payroll.status] ?? STATUS_STYLE.DRAFT;

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
      contratoAjustadoId: line.contratoAjustadoId ?? null,
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

  const FIXED_COLS = (isPaid || isApproved) ? 12 : 9;

  return (
    <div style={{ fontFamily: BODY }} className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <style>{`
        @keyframes nd-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .nd-up   { animation: nd-up 0.4s cubic-bezier(.2,.8,.2,1) both; }
        .nd-up-1 { animation: nd-up 0.4s 0.06s cubic-bezier(.2,.8,.2,1) both; }
        .nd-row:hover { background: #fafafa; }
        .nd-cell-input {
          width: 100%; border: 1px solid #d1d5db; border-radius: 5px;
          padding: 0.3rem 0.5rem; font-size: 0.75rem; font-family: ${BODY}; outline: none; background: #fff;
          box-sizing: border-box;
        }
        .nd-cell-input:focus { border-color: #F5C218; box-shadow: 0 0 0 2px rgba(245,194,24,0.15); }
        .nd-modal-input {
          width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 0.6rem 0.9rem; font-family: ${BODY}; font-size: 0.82rem; color: #374151; outline: none;
          margin-bottom: 0.75rem; box-sizing: border-box;
        }
        .nd-modal-input:focus { border-color: #F5C218; box-shadow: 0 0 0 3px rgba(245,194,24,0.12); }
        .nd-btn-ghost {
          display: inline-flex; align-items: center; gap: 5px;
          border: 1px solid #374151; border-radius: 7px; background: transparent;
          color: #9ca3af; font-family: ${BODY}; font-size: 0.78rem; font-weight: 600;
          padding: 0.45rem 0.85rem; cursor: pointer; transition: border-color 0.12s, color 0.12s;
        }
        .nd-btn-ghost:hover { border-color: #6b7280; color: #d1d5db; }
        .nd-btn-danger {
          display: inline-flex; align-items: center; gap: 5px;
          border: 1px solid rgba(239,68,68,0.3); border-radius: 7px; background: transparent;
          color: #dc2626; font-family: ${BODY}; font-size: 0.78rem; font-weight: 600;
          padding: 0.45rem 0.85rem; cursor: pointer;
        }
      `}</style>

      {/* Hero */}
      <div style={{ background: B.dark, padding: '2.5rem 2rem 2rem' }} className="nd-up">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <button onClick={() => navigate('/payrolls')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
                       cursor: 'pointer', fontFamily: MONO, fontSize: '0.65rem', color: '#555',
                       letterSpacing: '0.08em', marginBottom: '1rem', padding: 0 }}>
            <ArrowLeft style={{ width: '13px', height: '13px' }} />
            NÓMINAS
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '1.5rem', color: '#fff' }}>
                  NOM-{String(payroll.number).padStart(3, '0')}
                </span>
                <span style={{ fontFamily: BODY, fontSize: '0.72rem', fontWeight: 600,
                                background: ss.bg, color: ss.color, borderRadius: '4px', padding: '3px 9px' }}>
                  {STATUS_LABEL[payroll.status]}
                </span>
                <span style={{ fontFamily: BODY, fontSize: '0.7rem', color: '#6b7280',
                                background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 8px' }}>
                  {TYPE_LABEL[payroll.type]}
                </span>
              </div>
              <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '1.1rem', color: '#e5e7eb',
                           letterSpacing: '0.03em', margin: '0 0 4px' }}>
                {payroll.description}
              </p>
              <p style={{ fontFamily: MONO, fontSize: '0.7rem', color: '#666', margin: 0 }}>
                {payroll.project.code} — {payroll.project.name}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '1.75rem', color: '#fff', margin: 0, lineHeight: 1 }}>
                RD$ {Number(payroll.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </p>
              <p style={{ fontFamily: BODY, fontSize: '0.72rem', color: '#666', marginTop: '4px' }}>
                {payroll.lines?.length ?? 0} línea{(payroll.lines?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Meta strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem',
                          marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #2c2c2c' }}
               className="nd-up-1">
            <div>
              <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em', margin: '0 0 3px' }}>PERÍODO</p>
              <p style={{ fontFamily: MONO, fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>
                {payroll.periodStart.slice(0,10)} → {payroll.periodEnd.slice(0,10)}
              </p>
            </div>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em', margin: '0 0 3px' }}>CREADO POR</p>
              <p style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>{payroll.createdBy.name}</p>
            </div>
            {payroll.approvedBy && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em', margin: '0 0 3px' }}>APROBADO POR</p>
                <p style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>{payroll.approvedBy.name}</p>
              </div>
            )}
            {payroll.paidAt && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em', margin: '0 0 3px' }}>PAGADO EL</p>
                <p style={{ fontFamily: MONO, fontSize: '0.72rem', color: '#22c55e', margin: 0 }}>
                  {(payroll.paymentDate ?? payroll.paidAt).slice(0, 10)}
                </p>
              </div>
            )}
            {payroll.paymentMethod && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em', margin: '0 0 3px' }}>FORMA DE PAGO</p>
                <p style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>
                  {payroll.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.25rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Void reason */}
        {payroll.voidReason && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: '10px', padding: '0.85rem 1.1rem',
                          fontFamily: BODY, fontSize: '0.82rem', color: '#dc2626' }}>
            <span style={{ fontWeight: 600 }}>Razón de anulación:</span> {payroll.voidReason}
          </div>
        )}

        {/* Notes */}
        {payroll.notes && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
                          padding: '0.85rem 1.1rem', fontFamily: BODY, fontSize: '0.82rem', color: '#6b7280' }}>
            <span style={{ fontWeight: 600, color: B.dark }}>Notas: </span>{payroll.notes}
          </div>
        )}

        {/* Payment details */}
        {payroll.status === 'PAID' && (payroll.paymentBank || payroll.paymentReference || payroll.receiptNumber || payroll.receivedBy) && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
                          padding: '1rem 1.25rem' }}>
            <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '0.82rem', color: '#16a34a',
                         letterSpacing: '0.05em', margin: '0 0 0.75rem',
                         display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wallet style={{ width: '14px', height: '14px' }} /> DETALLE DEL PAGO
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {payroll.paymentBank && (
                <div>
                  <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#9ca3af', letterSpacing: '0.06em', margin: '0 0 2px' }}>BANCO</p>
                  <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark, margin: 0 }}>{payroll.paymentBank}</p>
                </div>
              )}
              {payroll.paymentReference && (
                <div>
                  <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#9ca3af', letterSpacing: '0.06em', margin: '0 0 2px' }}>NO. TRANSACCIÓN</p>
                  <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.82rem', color: B.dark, margin: 0 }}>{payroll.paymentReference}</p>
                </div>
              )}
              {payroll.receiptNumber && (
                <div>
                  <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#9ca3af', letterSpacing: '0.06em', margin: '0 0 2px' }}>NO. RECIBO</p>
                  <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.82rem', color: B.dark, margin: 0 }}>{payroll.receiptNumber}</p>
                </div>
              )}
              {payroll.receivedBy && (
                <div>
                  <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#9ca3af', letterSpacing: '0.06em', margin: '0 0 2px' }}>RECIBIDO POR</p>
                  <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark, margin: 0 }}>{payroll.receivedBy}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Linked payment order */}
        {payroll.paymentOrder && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.85rem 1.1rem' }}>
            <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '0.78rem', color: '#4f46e5',
                         letterSpacing: '0.06em', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link2 style={{ width: '13px', height: '13px' }} /> ORDEN DE PAGO VINCULADA
            </p>
            <Link to={`/payment-orders/${payroll.paymentOrder.id}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                         fontFamily: BODY, fontSize: '0.82rem', color: B.dark, textDecoration: 'none' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payroll.paymentOrder.concept}</span>
              <span style={{ fontFamily: MONO, fontWeight: 700, marginLeft: '1rem', flexShrink: 0 }}>
                RD$ {Number(payroll.paymentOrder.amount).toLocaleString('es-DO')}
              </span>
            </Link>
          </div>
        )}

        {/* Linked expense */}
        {payroll.expense && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
                          padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '8px',
                          fontFamily: BODY, fontSize: '0.82rem', color: '#6b7280' }}>
            <Receipt style={{ width: '14px', height: '14px', color: '#22c55e', flexShrink: 0 }} />
            Gasto vinculado auto-creado:
            <Link to={`/expenses/${payroll.expense.id}`}
              style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none', marginLeft: '4px' }}>
              RD$ {Number(payroll.expense.amount).toLocaleString('es-DO')} — ver gasto
            </Link>
          </div>
        )}

        {/* Status guidance */}
        {isDraft && (
          <div style={{ background: 'rgba(245,194,24,0.08)', border: '1px solid rgba(245,194,24,0.2)',
                          borderRadius: '10px', padding: '0.85rem 1.1rem',
                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                          fontFamily: BODY, fontSize: '0.82rem', color: '#92400e' }}>
            <AlertTriangle style={{ width: '15px', height: '15px', flexShrink: 0, marginTop: '1px', color: '#f59e0b' }} />
            <div>
              <span style={{ fontWeight: 600 }}>Nómina en borrador. </span>
              Flujo:{' '}
              {['Vincular orden de pago', 'Importar líneas', 'Aprobar', 'Exportar'].map((s, i, arr) => (
                <span key={s}>
                  <span style={{ fontFamily: MONO, fontSize: '0.7rem', background: 'rgba(245,194,24,0.15)',
                                   borderRadius: '4px', padding: '1px 6px' }}>{s}</span>
                  {i < arr.length - 1 && <ArrowRight style={{ display: 'inline', width: '11px', height: '11px', margin: '0 3px' }} />}
                </span>
              ))}
            </div>
          </div>
        )}
        {isApproved && (
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                          borderRadius: '10px', padding: '0.85rem 1.1rem',
                          display: 'flex', alignItems: 'center', gap: '8px',
                          fontFamily: BODY, fontSize: '0.82rem', color: '#15803d' }}>
            <CheckCircle style={{ width: '15px', height: '15px', flexShrink: 0 }} />
            <span><span style={{ fontWeight: 600 }}>Nómina aprobada.</span> Puedes exportarla en Excel o Word.</span>
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: '10px', padding: '0.75rem 1rem',
                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                          fontFamily: BODY, fontSize: '0.82rem', color: '#dc2626' }}>
            <AlertTriangle style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '1px' }} />
            <span style={{ flex: 1 }}>{actionError}</span>
            <button onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
              <X style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        )}

        {/* Action buttons */}
        {(canCreatePayroll || canApprovePayroll) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            {isDraft && (
              <>
                {canCreatePayroll && (
                  <Link to={`/payrolls/${id}/edit`} className="nd-btn-ghost">
                    <Pencil style={{ width: '13px', height: '13px' }} /> Editar
                  </Link>
                )}
                {canApprovePayroll && (
                  <button
                    onClick={() => { setActionError(''); approveMut.mutate(); }}
                    disabled={approveMut.isPending || (payroll.lines?.length ?? 0) === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                               background: '#2563eb', color: '#fff', border: 'none', borderRadius: '7px',
                               fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.05em',
                               padding: '0.5rem 1rem', cursor: 'pointer', opacity: approveMut.isPending || (payroll.lines?.length ?? 0) === 0 ? 0.6 : 1 }}>
                    <CheckCircle style={{ width: '14px', height: '14px' }} />
                    {approveMut.isPending ? 'APROBANDO…' : 'APROBAR'}
                  </button>
                )}
                {canCreatePayroll && (
                  <button onClick={() => { setActionError(''); setLinkModal(true); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                               border: '1px solid rgba(99,102,241,0.4)', borderRadius: '7px', background: 'transparent',
                               color: '#6366f1', fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600,
                               padding: '0.45rem 0.85rem', cursor: 'pointer' }}>
                    <Link2 style={{ width: '13px', height: '13px' }} /> Vincular orden de pago
                  </button>
                )}
                {canApprovePayroll && (
                  <button
                    onClick={() => { if (window.confirm('¿Eliminar esta nómina borrador?')) deleteMut.mutate(); }}
                    className="nd-btn-danger">
                    <Trash2 style={{ width: '13px', height: '13px' }} /> Eliminar
                  </button>
                )}
              </>
            )}
            {isApproved && canApprovePayroll && (
              <>
                <button onClick={() => { setActionError(''); setPayModal(true); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                             background: '#16a34a', color: '#fff', border: 'none', borderRadius: '7px',
                             fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.05em',
                             padding: '0.5rem 1rem', cursor: 'pointer' }}>
                  <DollarSign style={{ width: '14px', height: '14px' }} /> MARCAR PAGADA
                </button>
                <button onClick={() => { if (window.confirm('¿Revertir a Borrador?')) revertDraftMut.mutate(); }}
                  disabled={revertDraftMut.isPending}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                             border: '1px solid rgba(245,158,11,0.4)', borderRadius: '7px', background: 'transparent',
                             color: '#d97706', fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600,
                             padding: '0.45rem 0.85rem', cursor: 'pointer' }}>
                  ↩ Revertir a Borrador
                </button>
                <button onClick={() => setVoidModal(true)} className="nd-btn-danger">
                  <Ban style={{ width: '13px', height: '13px' }} /> Anular
                </button>
              </>
            )}
            {isPaid && !isVoided && canApprovePayroll && (
              <>
                {isAdmin && (
                  <button onClick={() => { if (window.confirm('¿Revertir a Aprobada?')) revertApprovedMut.mutate(); }}
                    disabled={revertApprovedMut.isPending}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                               border: '1px solid rgba(59,130,246,0.4)', borderRadius: '7px', background: 'transparent',
                               color: '#3b82f6', fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600,
                               padding: '0.45rem 0.85rem', cursor: 'pointer' }}>
                    ↩ Revertir a Aprobada
                  </button>
                )}
                <button onClick={() => setVoidModal(true)} className="nd-btn-danger">
                  <Ban style={{ width: '13px', height: '13px' }} /> Anular
                </button>
              </>
            )}
            {!isVoided && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleExport('xlsx')} className="nd-btn-ghost">
                  <Download style={{ width: '13px', height: '13px' }} /> Excel
                </button>
                <button onClick={() => handleExport('docx')} className="nd-btn-ghost">
                  <FileText style={{ width: '13px', height: '13px' }} /> Word
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lines table */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.875rem 1.25rem', background: B.dark, borderBottom: `2px solid ${B.yellow}` }}>
            <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', color: '#fff',
                         letterSpacing: '0.06em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet style={{ width: '15px', height: '15px', color: B.yellow }} />
              LÍNEAS DE NÓMINA
              <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#666', fontWeight: 400 }}>
                ({payroll.lines?.length ?? 0})
              </span>
            </p>
            {isDraft && canCreatePayroll && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => { if (confirm('¿Importar automáticamente las líneas desde las órdenes de pago vinculadas a esta nómina?')) importOrdersMut.mutate(); }}
                  disabled={importOrdersMut.isPending}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                             background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)',
                             borderRadius: '6px', fontFamily: BODY, fontSize: '0.72rem', fontWeight: 600,
                             padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                  📥 {importOrdersMut.isPending ? 'Importando...' : 'Importar desde órdenes'}
                </button>
                <button onClick={() => { setAddingLine(true); setActionError(''); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                             background: B.yellow, color: B.dark, border: 'none', borderRadius: '6px',
                             fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.04em',
                             padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                  <Plus style={{ width: '12px', height: '12px' }} /> Agregar línea
                </button>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {[
                    ['#', 'w-8'],
                    ['Suplidor', 'w-36'],
                    ['Concepto', ''],
                    ['Unidad', 'w-16 text-center'],
                    ['Cantidad', 'w-20 text-right'],
                    ['Precio Unit.', 'w-24 text-right'],
                    ['Monto', 'w-28 text-right'],
                    ['Banco', 'w-28'],
                    ['No. Cuenta', 'w-36'],
                  ].map(([h]) => (
                    <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: h === 'Cantidad' || h === 'Precio Unit.' || h === 'Monto' ? 'right' : h === 'Unidad' ? 'center' : 'left',
                                          fontFamily: MONO, fontSize: '0.6rem', color: '#9ca3af',
                                          fontWeight: 400, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      {(h as string).toUpperCase()}
                    </th>
                  ))}
                  {(isDraft || isApproved) && (
                    <th style={{ padding: '0.6rem 0.75rem', fontFamily: MONO, fontSize: '0.6rem', color: '#6366f1',
                                   fontWeight: 400, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      CONTRATO AJUST.
                    </th>
                  )}
                  {(isPaid || isApproved) && (
                    <>
                      <th style={{ padding: '0.6rem 0.75rem', fontFamily: MONO, fontSize: '0.6rem', color: '#16a34a', fontWeight: 400, letterSpacing: '0.06em' }}>BANCO ORIGEN</th>
                      <th style={{ padding: '0.6rem 0.75rem', fontFamily: MONO, fontSize: '0.6rem', color: '#16a34a', fontWeight: 400, letterSpacing: '0.06em' }}>NO. TRANSACCIÓN</th>
                      <th style={{ padding: '0.6rem 0.75rem', fontFamily: MONO, fontSize: '0.6rem', color: '#16a34a', fontWeight: 400, letterSpacing: '0.06em' }}>FECHA PAGO</th>
                      <th style={{ width: '40px' }} />
                    </>
                  )}
                  {(isDraft || isApproved) && <th style={{ width: '60px' }} />}
                </tr>
              </thead>
              <tbody>
                {(payroll.lines ?? []).map((line, idx) => (
                  editLineId === line.id ? (
                    <tr key={line.id} style={{ background: 'rgba(245,194,24,0.05)', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#9ca3af', fontSize: '0.7rem' }}>{line.lineNumber}</td>
                      <td style={{ padding: '0.4rem' }}><input className="nd-cell-input" placeholder="Suplidor" value={editLineForm.supplierName} onChange={(e) => setEditLineForm((f) => ({ ...f, supplierName: e.target.value }))} /></td>
                      <td style={{ padding: '0.4rem' }}><input className="nd-cell-input" placeholder="Concepto" value={editLineForm.description} onChange={(e) => setEditLineForm((f) => ({ ...f, description: e.target.value }))} /></td>
                      <td style={{ padding: '0.4rem' }}>
                        <select className="nd-cell-input" value={editLineForm.unit} onChange={(e) => setEditLineForm((f) => ({ ...f, unit: e.target.value }))}>
                          {UNITS.map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '0.4rem' }}><input type="number" min="0" step="0.001" className="nd-cell-input" style={{ textAlign: 'right' }} value={editLineForm.quantity} onChange={(e) => setEditLineForm((f) => ({ ...f, quantity: e.target.value }))} /></td>
                      <td style={{ padding: '0.4rem' }}><input type="number" min="0" step="0.01" className="nd-cell-input" style={{ textAlign: 'right' }} value={editLineForm.unitPrice} onChange={(e) => setEditLineForm((f) => ({ ...f, unitPrice: e.target.value }))} /></td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, color: B.dark }}>
                        RD$ {(parseFloat(editLineForm.quantity || '0') * parseFloat(editLineForm.unitPrice || '0')).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.4rem' }}><input className="nd-cell-input" placeholder="Banco" value={editLineForm.bankName} onChange={(e) => setEditLineForm((f) => ({ ...f, bankName: e.target.value }))} /></td>
                      <td style={{ padding: '0.4rem' }}><input className="nd-cell-input" placeholder="No. cuenta" value={editLineForm.bankAccount} onChange={(e) => setEditLineForm((f) => ({ ...f, bankAccount: e.target.value }))} /></td>
                      {(isDraft || isApproved) && (
                        <td style={{ padding: '0.4rem' }}>
                          <select className="nd-cell-input" style={{ borderColor: '#a5b4fc' }}
                            value={editLineForm.contratoAjustadoId || ''}
                            onChange={(e) => setEditLineForm((f: any) => ({ ...f, contratoAjustadoId: e.target.value || null }))}>
                            <option value="">Sin contrato</option>
                            {(projectContratos ?? []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.supplier?.name} - RD${Number(c.montoContratado).toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td style={{ padding: '0.4rem' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => updateLineMut.mutate({ lineId: line.id, d: submitLine(editLineForm) })}
                            style={{ padding: '5px 7px', borderRadius: '5px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>
                            <Save style={{ width: '12px', height: '12px' }} />
                          </button>
                          <button onClick={() => setEditLineId(null)}
                            style={{ padding: '5px 7px', borderRadius: '5px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                            <X style={{ width: '12px', height: '12px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={line.id} className="nd-row"
                      style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 1 ? '#fafafa' : '#fff' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af' }}>{line.lineNumber}</td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.78rem', color: B.dark, margin: 0 }}>
                          {line.supplierName || <span style={{ color: '#d1d5db' }}>—</span>}
                        </p>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.78rem', color: B.dark, margin: 0 }}>{line.description}</p>
                        {line.notes && <p style={{ fontFamily: BODY, fontSize: '0.68rem', color: '#9ca3af', margin: '2px 0 0' }}>{line.notes}</p>}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontFamily: MONO, fontSize: '0.68rem', color: '#6b7280' }}>{line.unit}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: MONO, fontSize: '0.75rem', color: '#374151' }}>
                        {Number(line.quantity).toLocaleString('es-DO', { maximumFractionDigits: 3 })}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: MONO, fontSize: '0.75rem', color: '#374151' }}>
                        RD$ {Number(line.unitPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: MONO, fontWeight: 700, fontSize: '0.8rem', color: B.dark }}>
                        RD$ {Number(line.subtotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: BODY, fontSize: '0.75rem', color: '#6b7280' }}>
                        {line.bankName || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: MONO, fontSize: '0.72rem', color: '#6b7280' }}>
                        {line.bankAccount || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      {(isDraft || isApproved) && (
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          {editContratoLineId === line.id ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <select className="nd-cell-input" style={{ borderColor: '#a5b4fc', flex: 1 }}
                                value={selectedContratoId || ''}
                                onChange={(e) => setSelectedContratoId(e.target.value || null)}>
                                <option value="">Sin contrato</option>
                                {(projectContratos ?? []).map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.supplier?.name} - RD${Number(c.montoContratado).toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                                  </option>
                                ))}
                              </select>
                              <button onClick={() => updateLineContratoMut.mutate({ lineId: line.id, contratoAjustadoId: selectedContratoId })}
                                disabled={updateLineContratoMut.isPending}
                                style={{ padding: '4px 7px', borderRadius: '5px', background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>✓</button>
                              <button onClick={() => setEditContratoLineId(null)}
                                style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280', fontSize: '0.75rem' }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditContratoLineId(line.id); setSelectedContratoId(line.contratoAjustadoId ?? null); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: BODY, fontSize: '0.72rem', color: '#6366f1' }}>
                              {line.contratoAjustado ? (
                                <span>{line.contratoAjustado.descripcionTrabajo?.substring(0, 30)}...</span>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>Asignar</span>
                              )}
                            </button>
                          )}
                        </td>
                      )}
                      {(isPaid || isApproved) && (
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          {paymentLineId === line.id ? (
                            <input className="nd-cell-input" style={{ borderColor: '#86efac' }}
                              placeholder="Banco origen"
                              value={paymentForm.paymentBank}
                              onChange={(e) => setPaymentForm((f) => ({ ...f, paymentBank: e.target.value }))}
                            />
                          ) : (
                            line.paymentBank
                              ? <span style={{ fontFamily: BODY, fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>{line.paymentBank}</span>
                              : <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#d1d5db' }}>pendiente</span>
                          )}
                        </td>
                      )}
                      {(isPaid || isApproved) && (
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          {paymentLineId === line.id ? (
                            <input className="nd-cell-input" style={{ borderColor: '#86efac' }}
                              placeholder="No. transacción"
                              value={paymentForm.paymentReference}
                              onChange={(e) => setPaymentForm((f) => ({ ...f, paymentReference: e.target.value }))}
                            />
                          ) : (
                            line.paymentReference
                              ? <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>{line.paymentReference}</span>
                              : <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#d1d5db' }}>pendiente</span>
                          )}
                        </td>
                      )}
                      {(isPaid || isApproved) && (
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          {paymentLineId === line.id ? (
                            <input type="date" className="nd-cell-input" style={{ borderColor: '#86efac' }}
                              value={paymentForm.paidAt}
                              onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))}
                            />
                          ) : (
                            line.paidAt
                              ? <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: '#16a34a' }}>{new Date(line.paidAt).toLocaleDateString('es-DO', { timeZone: 'UTC' })}</span>
                              : <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#d1d5db' }}>pendiente</span>
                          )}
                        </td>
                      )}
                      {(isPaid || isApproved) && (
                        <td style={{ padding: '0.5rem 0.5rem' }}>
                          {paymentLineId === line.id ? (
                            <div style={{ display: 'flex', gap: '3px' }}>
                              <button onClick={() => recordPaymentMut.mutate(line.id)} disabled={recordPaymentMut.isPending}
                                style={{ padding: '5px 7px', borderRadius: '5px', background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✓</button>
                              <button onClick={() => setPaymentLineId(null)}
                                style={{ padding: '5px 7px', borderRadius: '5px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280', fontSize: '0.75rem' }}>✕</button>
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
                              style={{ padding: '5px 7px', borderRadius: '5px', border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', color: '#16a34a', fontSize: '0.75rem' }}
                              title="Registrar comprobante">✎</button>
                          )}
                        </td>
                      )}
                      {(isDraft || isApproved) && (
                        <td style={{ padding: '0.5rem 0.5rem' }}>
                          <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                            {isDraft && (
                              <button onClick={() => openEdit(line)}
                                style={{ padding: '5px 7px', borderRadius: '5px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                                <Pencil style={{ width: '11px', height: '11px' }} />
                              </button>
                            )}
                            <button onClick={() => { if (window.confirm('¿Eliminar línea?')) deleteLineMut.mutate(line.id); }}
                              style={{ padding: '5px 7px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fff9f9', cursor: 'pointer', color: '#dc2626' }}>
                              <Trash2 style={{ width: '11px', height: '11px' }} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                ))}

                {/* Add line row */}
                {addingLine && (
                  <tr style={{ background: 'rgba(245,194,24,0.05)', borderTop: `2px solid ${B.yellow}`, borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af' }}>+</td>
                    <td style={{ padding: '0.4rem' }}><input className="nd-cell-input" placeholder="Nombre suplidor" value={lineForm.supplierName} onChange={(e) => setLineForm((f) => ({ ...f, supplierName: e.target.value }))} /></td>
                    <td style={{ padding: '0.4rem' }}><input className="nd-cell-input" placeholder="Concepto del servicio" value={lineForm.description} onChange={(e) => setLineForm((f) => ({ ...f, description: e.target.value }))} /></td>
                    <td style={{ padding: '0.4rem' }}>
                      <select className="nd-cell-input" value={lineForm.unit} onChange={(e) => setLineForm((f) => ({ ...f, unit: e.target.value }))}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '0.4rem' }}><input type="number" min="0" step="0.001" className="nd-cell-input" style={{ textAlign: 'right' }} placeholder="0" value={lineForm.quantity} onChange={(e) => setLineForm((f) => ({ ...f, quantity: e.target.value }))} /></td>
                    <td style={{ padding: '0.4rem' }}><input type="number" min="0" step="0.01" className="nd-cell-input" style={{ textAlign: 'right' }} placeholder="0.00" value={lineForm.unitPrice} onChange={(e) => setLineForm((f) => ({ ...f, unitPrice: e.target.value }))} /></td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: MONO, fontWeight: 700, fontSize: '0.72rem', color: B.dark }}>
                      RD$ {(parseFloat(lineForm.quantity || '0') * parseFloat(lineForm.unitPrice || '0')).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.4rem' }}><input className="nd-cell-input" placeholder="Banco" value={lineForm.bankName} onChange={(e) => setLineForm((f) => ({ ...f, bankName: e.target.value }))} /></td>
                    <td style={{ padding: '0.4rem' }}><input className="nd-cell-input" placeholder="No. cuenta" value={lineForm.bankAccount} onChange={(e) => setLineForm((f) => ({ ...f, bankAccount: e.target.value }))} /></td>
                    <td style={{ padding: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => addLineMut.mutate(submitLine(lineForm))}
                          disabled={!lineForm.description || !lineForm.quantity || !lineForm.unitPrice}
                          style={{ padding: '5px 8px', borderRadius: '5px', background: '#16a34a', color: '#fff', border: 'none',
                                     cursor: !lineForm.description || !lineForm.quantity || !lineForm.unitPrice ? 'not-allowed' : 'pointer',
                                     opacity: !lineForm.description || !lineForm.quantity || !lineForm.unitPrice ? 0.4 : 1 }}>
                          <Save style={{ width: '12px', height: '12px' }} />
                        </button>
                        <button onClick={() => { setAddingLine(false); setLineForm(emptyLine); }}
                          style={{ padding: '5px 7px', borderRadius: '5px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                          <X style={{ width: '12px', height: '12px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${B.yellow}`, background: 'rgba(245,194,24,0.06)' }}>
                  <td colSpan={isDraft ? FIXED_COLS : FIXED_COLS - 1}
                    style={{ padding: '0.85rem 1rem', textAlign: 'right',
                               fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem',
                               color: B.dark, letterSpacing: '0.06em' }}>
                    TOTAL A PAGAR
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right',
                                 fontFamily: MONO, fontWeight: 700, fontSize: '1rem', color: B.dark, whiteSpace: 'nowrap' }}>
                    RD$ {Number(payroll.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </td>
                  {(isDraft || isApproved) && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Pay Modal */}
      {payModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px',
                          padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '1.25rem', color: B.dark,
                          letterSpacing: '0.04em', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign style={{ width: '18px', height: '18px', color: '#16a34a' }} />
              REGISTRAR PAGO
            </h3>
            <p style={{ fontFamily: BODY, fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1.25rem' }}>
              Complete los datos del pago para marcar la nómina como pagada.
            </p>

            <label style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
              Forma de pago *
            </label>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              {(['CASH', 'TRANSFER'] as const).map((m) => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                          fontFamily: BODY, fontSize: '0.82rem', color: '#374151' }}>
                  <input type="radio" name="payMethod" value={m}
                    checked={payForm.paymentMethod === m}
                    onChange={() => setPayForm((f) => ({ ...f, paymentMethod: m }))}
                    style={{ accentColor: B.yellow }} />
                  {m === 'CASH' ? 'Efectivo' : 'Transferencia bancaria'}
                </label>
              ))}
            </div>

            <label style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
              Fecha de pago *
            </label>
            <input type="date" className="nd-modal-input"
              value={payForm.paymentDate}
              onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))} />

            {payForm.paymentMethod === 'TRANSFER' && (
              <>
                <label style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Banco</label>
                <input type="text" className="nd-modal-input" placeholder="Ej: Banco Popular"
                  value={payForm.paymentBank} onChange={(e) => setPayForm((f) => ({ ...f, paymentBank: e.target.value }))} />
                <label style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>No. de transacción / referencia</label>
                <input type="text" className="nd-modal-input" placeholder="Ej: TRF-2026-001234"
                  value={payForm.paymentReference} onChange={(e) => setPayForm((f) => ({ ...f, paymentReference: e.target.value }))} />
              </>
            )}

            {payForm.paymentMethod === 'CASH' && (
              <div style={{ background: 'rgba(245,194,24,0.08)', border: '1px solid rgba(245,194,24,0.2)',
                              borderRadius: '8px', padding: '0.85rem', marginBottom: '0.75rem' }}>
                <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '0.78rem', color: '#92400e',
                             letterSpacing: '0.05em', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Receipt style={{ width: '13px', height: '13px' }} /> DATOS DEL RECIBO (OBLIGATORIOS)
                </p>
                <label style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>No. de recibo *</label>
                <input type="text" className="nd-modal-input" placeholder="Ej: REC-001"
                  value={payForm.receiptNumber} onChange={(e) => setPayForm((f) => ({ ...f, receiptNumber: e.target.value }))} />
                <label style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Nombre de quien recibió *</label>
                <input type="text" className="nd-modal-input" placeholder="Ej: Juan Pérez" style={{ marginBottom: 0 }}
                  value={payForm.receivedBy} onChange={(e) => setPayForm((f) => ({ ...f, receivedBy: e.target.value }))} />
              </div>
            )}

            {payForm.paymentMethod === 'CASH' && (!payForm.receiptNumber.trim() || !payForm.receivedBy.trim()) && (
              <p style={{ fontFamily: BODY, fontSize: '0.72rem', color: '#f59e0b', marginBottom: '0.75rem',
                           display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle style={{ width: '12px', height: '12px' }} />
                Complete el número de recibo y el nombre para confirmar el pago.
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => payMut.mutate({
                  paymentMethod:    payForm.paymentMethod,
                  paymentDate:      payForm.paymentDate,
                  paymentBank:      payForm.paymentBank      || undefined,
                  paymentReference: payForm.paymentReference || undefined,
                  receiptNumber:    payForm.receiptNumber    || undefined,
                  receivedBy:       payForm.receivedBy       || undefined,
                })}
                disabled={payMut.isPending || !payForm.paymentDate ||
                  (payForm.paymentMethod === 'CASH' && (!payForm.receiptNumber.trim() || !payForm.receivedBy.trim()))}
                style={{ flex: 1, padding: '0.6rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px',
                           fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em', cursor: 'pointer',
                           opacity: payMut.isPending ? 0.7 : 1 }}>
                {payMut.isPending ? 'Guardando…' : 'CONFIRMAR PAGO'}
              </button>
              <button onClick={() => setPayModal(false)}
                style={{ padding: '0.6rem 1rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff',
                           fontFamily: BODY, fontSize: '0.82rem', cursor: 'pointer', color: '#6b7280' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Order Modal */}
      {linkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px',
                          padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '1.25rem', color: B.dark,
                          letterSpacing: '0.04em', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link2 style={{ width: '18px', height: '18px', color: '#6366f1' }} />
              VINCULAR ORDEN DE PAGO
            </h3>
            <p style={{ fontFamily: BODY, fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1.25rem' }}>
              Selecciona la orden de pago de tipo Nómina que corresponde a esta nómina.
            </p>
            {(availableOrders ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', fontFamily: BODY, fontSize: '0.82rem', color: '#9ca3af' }}>
                No hay órdenes de pago de tipo Nómina pendientes de vincular en este proyecto.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem',
                              maxHeight: '240px', overflowY: 'auto' }}>
                {(availableOrders ?? []).map((o: any) => (
                  <label key={o.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem 1rem',
                               borderRadius: '8px', border: `1px solid ${linkOrderId === o.id ? '#6366f1' : '#e5e7eb'}`,
                               background: linkOrderId === o.id ? 'rgba(99,102,241,0.06)' : '#fff',
                               cursor: 'pointer', transition: 'all 0.12s' }}>
                    <input type="radio" name="linkOrder" value={o.id}
                      checked={linkOrderId === o.id}
                      onChange={() => setLinkOrderId(o.id)}
                      style={{ accentColor: '#6366f1' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark, margin: 0,
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.concept}</p>
                      <p style={{ fontFamily: BODY, fontSize: '0.7rem', color: '#9ca3af', margin: 0 }}>{o.supplier?.name ?? o.payingCompany}</p>
                    </div>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.78rem', color: B.dark, flexShrink: 0 }}>
                      RD$ {Number(o.amount).toLocaleString('es-DO')}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => linkOrderMut.mutate(linkOrderId)}
                disabled={!linkOrderId || linkOrderMut.isPending}
                style={{ flex: 1, padding: '0.6rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px',
                           fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em', cursor: 'pointer',
                           opacity: !linkOrderId || linkOrderMut.isPending ? 0.6 : 1 }}>
                {linkOrderMut.isPending ? 'Vinculando…' : 'VINCULAR'}
              </button>
              <button onClick={() => { setLinkModal(false); setLinkOrderId(''); }}
                style={{ padding: '0.6rem 1rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff',
                           fontFamily: BODY, fontSize: '0.82rem', cursor: 'pointer', color: '#6b7280' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px',
                          padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '1.25rem', color: B.dark,
                          letterSpacing: '0.04em', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ban style={{ width: '18px', height: '18px', color: '#dc2626' }} />
              ANULAR NÓMINA
            </h3>
            <p style={{ fontFamily: BODY, fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1.25rem' }}>
              Esta acción anulará la nómina y el gasto vinculado. No se puede deshacer.
            </p>
            <label style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
              Razón de anulación *
            </label>
            <textarea rows={3}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.6rem 0.9rem',
                         fontFamily: BODY, fontSize: '0.82rem', color: '#374151', outline: 'none',
                         resize: 'none', boxSizing: 'border-box', marginBottom: '1rem' }}
              placeholder="Explique el motivo de la anulación…"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => voidMut.mutate()}
                disabled={voidReason.trim().length < 5 || voidMut.isPending}
                style={{ flex: 1, padding: '0.6rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px',
                           fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em', cursor: 'pointer',
                           opacity: voidReason.trim().length < 5 || voidMut.isPending ? 0.6 : 1 }}>
                {voidMut.isPending ? 'Anulando…' : 'CONFIRMAR ANULACIÓN'}
              </button>
              <button onClick={() => { setVoidModal(false); setVoidReason(''); }}
                style={{ flex: 1, padding: '0.6rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff',
                           fontFamily: BODY, fontSize: '0.82rem', cursor: 'pointer', color: '#6b7280' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
