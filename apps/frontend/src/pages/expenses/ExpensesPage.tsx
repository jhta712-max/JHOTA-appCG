import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Search, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { expensesApi, projectsApi } from '../../api';
import { PAYMENT_METHOD_LABELS } from '../../types';
import { fmtDate } from '../../utils/date';
import api from '../../api/client';
import { useRole } from '../../hooks/useRole';

const B = { dark: '#1C1C1C', yellow: '#F5C218', darkAlt: '#141414' } as const;
const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const BODY    = "'DM Sans', system-ui, sans-serif";
const MONO    = "'Space Mono', monospace";

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

function parseCSV(text: string) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return obj;
  }).filter((r) => r.fecha && r.monto);
}

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { canCreateExpense } = useRole();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('ACTIVE');
  const [page,     setPage]     = useState(1);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importRows,   setImportRows]   = useState<any[]>([]);
  const [importModal,  setImportModal]  = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; err: number; results: any[] } | null>(null);

  useEffect(() => {
    if (!document.querySelector('[data-smi-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=Space+Mono:wght@400;700&display=swap';
      link.setAttribute('data-smi-fonts', '1');
      document.head.appendChild(link);
    }
  }, []);

  const importMut = useMutation({
    mutationFn: (rows: any[]) => api.post('/expenses/bulk-import', { rows }).then((r) => r.data.data),
    onSuccess: (data) => { setImportResult(data); qc.invalidateQueries({ queryKey: ['expenses'] }); },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text).map((r) => ({
        fecha: r.fecha, descripcion: r.descripcion, proveedor: r.proveedor || undefined,
        categoria: r.categoria, monto: parseFloat(r.monto), metodo_pago: r.metodo_pago || 'CASH',
        proyecto: r.proyecto, notas: r.notas || undefined,
      }));
      setImportRows(rows); setImportResult(null); setImportModal(true);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => r.data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, selectedProjectId, status, page],
    queryFn:  () => expensesApi.list({
      search:    search || undefined,
      projectId: selectedProjectId !== 'all' ? selectedProjectId : undefined,
      status:    status || undefined,
      page,
      limit: 30,
    }),
    select: (r) => r.data,
  });

  const expenses   = data?.data ?? [];
  const pagination = data?.pagination;
  const projects   = projectsData ?? [];
  const tabTotal   = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div style={{ fontFamily: BODY }} className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <style>{`
        @keyframes exp-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .exp-up   { animation: exp-up 0.4s cubic-bezier(.2,.8,.2,1) both; }
        .exp-up-1 { animation: exp-up 0.4s 0.07s cubic-bezier(.2,.8,.2,1) both; }
        .exp-row { transition: box-shadow 0.12s, transform 0.12s; }
        .exp-row:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.07); transform: translateY(-1px); }
        .exp-tab { transition: all 0.12s; }
        .exp-ctrl {
          border: 1px solid #374151;
          border-radius: 7px;
          background: transparent;
          padding: 0.45rem 0.85rem;
          font-size: 0.78rem;
          font-family: ${BODY};
          color: #d1d5db;
          outline: none;
        }
        .exp-ctrl:focus { border-color: #F5C218; box-shadow: 0 0 0 3px rgba(245,194,24,0.12); }
        .exp-ctrl option { background: #1C1C1C; color: #fff; }
      `}</style>

      {/* Hero band */}
      <div style={{ background: B.dark, padding: '2.5rem 2rem 0' }} className="exp-up">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingBottom: '1.5rem' }}>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                MÓDULO / GASTOS
              </p>
              <h1 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)',
                            color: '#fff', lineHeight: 1.0, letterSpacing: '-0.01em', margin: 0 }}>
                GASTOS
              </h1>
              <p style={{ fontFamily: BODY, fontSize: '0.82rem', color: '#666', marginTop: '0.4rem' }}>
                {pagination?.total ?? 0} gastos registrados
              </p>
            </div>
            {canCreateExpense && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
                <button onClick={() => fileRef.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                             background: 'transparent', color: '#9ca3af',
                             border: '1px solid #374151', borderRadius: '8px',
                             fontFamily: DISPLAY, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.05em',
                             padding: '0.6rem 1rem', cursor: 'pointer' }}
                  className="hover:border-gray-500 transition-colors">
                  <Upload style={{ width: '14px', height: '14px' }} />
                  IMPORTAR CSV
                </button>
                <Link to="/expenses/new"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                             background: B.yellow, color: B.dark,
                             fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.06em',
                             padding: '0.65rem 1.25rem', borderRadius: '8px', textDecoration: 'none' }}>
                  <Plus style={{ width: '16px', height: '16px' }} />
                  NUEVO
                </Link>
              </div>
            )}
          </div>

          {/* Project tabs */}
          <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '0' }} className="exp-up-1">
            {[{ id: 'all', code: 'TODOS', name: 'Todos' }, ...projects.map((p) => ({ id: p.id, code: p.code, name: p.name }))].map((p) => (
              <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setPage(1); }}
                className="exp-tab"
                style={{ fontFamily: MONO, fontSize: '0.65rem', letterSpacing: '0.06em',
                           padding: '0.5rem 1rem',
                           background: selectedProjectId === p.id ? B.yellow : 'transparent',
                           color: selectedProjectId === p.id ? B.dark : '#6b7280',
                           border: 'none', borderRadius: '6px 6px 0 0',
                           cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: selectedProjectId === p.id ? 700 : 400 }}>
                {p.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.25rem 2rem' }}>

        {/* Project info + filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {selectedProjectId !== 'all' && (() => {
            const p = projects.find((x) => x.id === selectedProjectId);
            return p ? (
              <div style={{ background: 'rgba(245,194,24,0.08)', border: '1px solid rgba(245,194,24,0.2)',
                              borderRadius: '8px', padding: '0.5rem 1rem',
                              display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '0.85rem', color: B.dark, margin: 0, letterSpacing: '0.04em' }}>
                    {p.name}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af', margin: 0 }}>
                    {p.code}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.82rem', color: B.dark, margin: 0 }}>
                    {formatCurrency(tabTotal)}
                  </p>
                  <p style={{ fontFamily: BODY, fontSize: '0.65rem', color: '#9ca3af', margin: 0 }}>en vista</p>
                </div>
              </div>
            ) : null;
          })()}
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                                width: '14px', height: '14px', color: '#9ca3af' }} />
              <input
                style={{ width: '100%', paddingLeft: '2rem', boxSizing: 'border-box',
                           border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff',
                           padding: '0.5rem 0.85rem 0.5rem 2rem',
                           fontFamily: BODY, fontSize: '0.8rem', color: '#374151', outline: 'none' }}
                placeholder="Buscar descripción..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              style={{ border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff',
                         padding: '0.5rem 0.85rem', fontFamily: BODY, fontSize: '0.8rem', color: '#374151', outline: 'none' }}
              value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="VOIDED">Anulados</option>
            </select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', fontFamily: MONO, fontSize: '0.72rem', color: '#9ca3af', letterSpacing: '0.08em' }}>
            CARGANDO...
          </div>
        ) : expenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 0' }}>
            <Receipt style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 1rem' }} />
            <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '1rem', color: '#9ca3af', letterSpacing: '0.05em' }}>
              NO HAY GASTOS REGISTRADOS
            </p>
            {canCreateExpense && (
              <Link to="/expenses/new"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '1rem',
                           background: B.yellow, color: B.dark, fontFamily: DISPLAY, fontWeight: 800,
                           fontSize: '0.82rem', letterSpacing: '0.05em',
                           padding: '0.55rem 1rem', borderRadius: '7px', textDecoration: 'none' }}>
                Registrar primer gasto
              </Link>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {expenses.map((e) => (
                <Link key={e.id} to={`/expenses/${e.id}`} style={{ textDecoration: 'none' }}>
                  <div className="exp-row"
                    style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb',
                               borderLeft: `4px solid ${e.status === 'VOIDED' ? '#fca5a5' : B.yellow}`,
                               display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.1rem',
                               opacity: e.status === 'VOIDED' ? 0.65 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.85rem', color: B.dark,
                                   margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description}
                      </p>
                      <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af', margin: '2px 0 0' }}>
                        {selectedProjectId === 'all' && <span style={{ color: '#6b7280', fontWeight: 700 }}>{e.project.code} · </span>}
                        {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                        {e.hasFiscalDoc && <span style={{ color: '#3b82f6', marginLeft: '6px' }}>NCF</span>}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.9rem', color: B.dark, margin: 0 }}>
                        {formatCurrency(Number(e.amount))}
                      </p>
                      <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af', margin: '2px 0 0' }}>
                        {fmtDate(e.expenseDate)}
                      </p>
                    </div>
                    {e.status === 'VOIDED' && (
                      <span style={{ fontFamily: BODY, fontSize: '0.68rem', fontWeight: 600, color: '#dc2626',
                                      background: 'rgba(239,68,68,0.1)', borderRadius: '4px', padding: '2px 7px', flexShrink: 0 }}>
                        Anulado
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  style={{ border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff',
                             padding: '0.45rem 1rem', fontFamily: BODY, fontSize: '0.78rem',
                             cursor: !pagination.hasPrevPage ? 'not-allowed' : 'pointer',
                             opacity: !pagination.hasPrevPage ? 0.4 : 1 }}
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setPage(p => p - 1)}>
                  Anterior
                </button>
                <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af' }}>
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  style={{ border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff',
                             padding: '0.45rem 1rem', fontFamily: BODY, fontSize: '0.78rem',
                             cursor: !pagination.hasNextPage ? 'not-allowed' : 'pointer',
                             opacity: !pagination.hasNextPage ? 0.4 : 1 }}
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage(p => p + 1)}>
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* CSV Import Modal */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '760px',
                          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                          boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                           padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '1.25rem', color: B.dark,
                               letterSpacing: '0.04em', margin: 0 }}>
                  IMPORTAR GASTOS CSV
                </h2>
                <p style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0' }}>
                  {importRows.length} registros detectados
                </p>
              </div>
              <button onClick={() => { setImportModal(false); setImportResult(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
            {importResult && (
              <div style={{ margin: '1rem 1.5rem 0',
                              background: importResult.err === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(245,194,24,0.1)',
                              border: `1px solid ${importResult.err === 0 ? 'rgba(34,197,94,0.2)' : 'rgba(245,194,24,0.3)'}`,
                              borderRadius: '8px', padding: '0.75rem 1rem',
                              display: 'flex', alignItems: 'center', gap: '8px',
                              fontFamily: BODY, fontSize: '0.82rem',
                              color: importResult.err === 0 ? '#16a34a' : '#92400e' }}>
                {importResult.err === 0
                  ? <><CheckCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} /> {importResult.ok} gastos importados.</>
                  : <><AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} /> {importResult.ok} importados, {importResult.err} con error.</>
                }
              </div>
            )}
            {!importResult && (
              <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: B.dark }}>
                      {['Fecha', 'Proveedor', 'Descripción', 'Categoría', 'Monto'].map((h) => (
                        <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: h === 'Monto' ? 'right' : 'left',
                                              fontFamily: MONO, fontSize: '0.6rem', color: '#888',
                                              fontWeight: 400, letterSpacing: '0.08em' }}>
                          {h.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 20).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.4rem 0.75rem', fontFamily: MONO, color: '#6b7280' }}>{r.fecha}</td>
                        <td style={{ padding: '0.4rem 0.75rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: BODY }}>{r.proveedor}</td>
                        <td style={{ padding: '0.4rem 0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: BODY }}>{r.descripcion}</td>
                        <td style={{ padding: '0.4rem 0.75rem' }}>
                          <span style={{ background: 'rgba(245,194,24,0.15)', color: '#92400e',
                                          borderRadius: '4px', padding: '1px 6px', fontFamily: BODY }}>
                            {r.categoria}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontFamily: MONO, fontWeight: 700, color: B.dark }}>
                          {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(r.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importRows.length > 20 && (
                  <p style={{ fontFamily: MONO, fontSize: '0.62rem', color: '#9ca3af', textAlign: 'center', marginTop: '0.75rem' }}>
                    Mostrando 20 de {importRows.length} — todos serán importados
                  </p>
                )}
              </div>
            )}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f3f4f6',
                           display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontFamily: BODY, fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>
                Las categorías nuevas se crean automáticamente
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => { setImportModal(false); setImportResult(null); }}
                  style={{ border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff',
                             padding: '0.5rem 1rem', fontFamily: BODY, fontSize: '0.8rem', cursor: 'pointer' }}>
                  {importResult ? 'Cerrar' : 'Cancelar'}
                </button>
                {!importResult && (
                  <button onClick={() => importMut.mutate(importRows)} disabled={importMut.isPending}
                    style={{ background: B.yellow, color: B.dark, border: 'none', borderRadius: '7px',
                               padding: '0.5rem 1.25rem', fontFamily: DISPLAY, fontWeight: 800,
                               fontSize: '0.85rem', letterSpacing: '0.05em', cursor: importMut.isPending ? 'not-allowed' : 'pointer',
                               opacity: importMut.isPending ? 0.7 : 1 }}>
                    {importMut.isPending ? 'Importando...' : `Importar ${importRows.length} gastos`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
