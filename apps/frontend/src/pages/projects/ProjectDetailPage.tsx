import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjectItems, useCreateProjectItem, useUpdateProjectItem } from '../../hooks/useProjectItems';
import {
  ArrowLeft, Plus, FolderOpen, MapPin, User,
  Calendar, TrendingUp, Receipt, Edit, AlertCircle, BarChart2, FileText, ChevronRight, Upload,
  Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp, Trash2, UserPlus, Download,
} from 'lucide-react';
import { projectsApi, expensesApi, quotationsApi, projectSuppliersApi, suppliersApi, type ProjectSupplierEntry, type SupplierSuggestion } from '../../api';
import { useRole } from '../../hooks/useRole';
import { PAYMENT_METHOD_LABELS, PROJECT_STATUS_LABELS } from '../../types';
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, type QuotationStatus } from '../../types/quotation';
import { fmtDate } from '../../utils/date';
import { DetailPageSkeleton } from '../../components/ui/DetailPageSkeleton';
import { PAGE_META }           from '../../utils/routeMeta';

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-active', PAUSED: 'badge-paused',
  COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled',
};

// Industrial status badge styles (sharp corners, dark bg + accent text)
const STATUS_INDUSTRIAL: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:    { bg: 'bg-green-900/40',  text: 'text-green-400',  label: 'Activo' },
  PAUSED:    { bg: 'bg-amber-900/40',  text: 'text-amber-400',  label: 'Pausado' },
  COMPLETED: { bg: 'bg-blue-900/40',   text: 'text-blue-400',   label: 'Completado' },
  CANCELLED: { bg: 'bg-red-900/40',    text: 'text-red-400',    label: 'Cancelado' },
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSupervisor: canEdit, isAdmin } = useRole();
  const qc = useQueryClient();
  const canManageBudgets = canEdit || isAdmin;
  const canManageSuppliers = canEdit || isAdmin;

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [addSupplierId, setAddSupplierId] = useState('');

  const { data: projSuppliersRes } = useQuery({
    queryKey: ['project-suppliers', id],
    queryFn: () => projectSuppliersApi.list(id!),
    enabled: !!id,
  });
  const assignedSuppliers: ProjectSupplierEntry[] = projSuppliersRes?.data.data ?? [];

  const { data: allSuppliersRes } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.list({ onlyActive: true }),
    enabled: canManageSuppliers && showAddSupplier,
  });
  const allSuppliers = allSuppliersRes?.data.data ?? [];

  const assignMut = useMutation({
    mutationFn: (supplierId: string) => projectSuppliersApi.assign(id!, supplierId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-suppliers', id] });
      setShowAddSupplier(false);
      setAddSupplierId('');
    },
  });

  const removeMut = useMutation({
    mutationFn: (supplierId: string) => projectSuppliersApi.remove(id!, supplierId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-suppliers', id] }),
  });

  const [showSuggestions, setShowSuggestions] = useState(false);

  const importMut = useMutation({
    mutationFn: () => projectSuppliersApi.importFromPayments(id!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['project-suppliers', id] });
      const { imported, skipped } = res.data.data;
      alert(`Importados: ${imported} suplidores nuevos. Ya asignados previamente: ${skipped}.`);
    },
  });

  const { data: suggestionsRes, isLoading: suggestionsLoading, refetch: fetchSuggestions } = useQuery({
    queryKey: ['supplier-suggestions', id],
    queryFn: () => projectSuppliersApi.getSuggestions(id!),
    enabled: false,
  });
  const suggestions: SupplierSuggestion[] = suggestionsRes?.data.data ?? [];

  // ── Sub-presupuestos por categoría ───────────────────────
  const { data: categoryBudgets = [] } = useQuery({
    queryKey: ['category-budgets', id],
    queryFn:  () => projectsApi.getCategoryBudgets(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const [cbEditing, setCbEditing] = useState<{ categoryId: number; budget: string } | null>(null);
  const [cbNewCatId, setCbNewCatId] = useState('');
  const [cbNewBudget, setCbNewBudget] = useState('');

  const upsertCbMut = useMutation({
    mutationFn: ({ categoryId, budget }: { categoryId: number; budget: number }) =>
      projectsApi.upsertCategoryBudget(id!, categoryId, budget),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-budgets', id] });
      setCbEditing(null); setCbNewCatId(''); setCbNewBudget('');
    },
  });

  const deleteCbMut = useMutation({
    mutationFn: (categoryId: number) => projectsApi.deleteCategoryBudget(id!, categoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-budgets', id] }),
  });

  // ── Items de proyecto ─────────────────────────────────────
  const { data: items = [] }     = useProjectItems(id);
  const createItem               = useCreateProjectItem(id!);
  const updateItem               = useUpdateProjectItem(id!);
  const [itemName, setItemName]  = useState('');
  const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    await createItem.mutateAsync(itemName.trim());
    setItemName('');
  };

  const handleToggleActive = (item: { id: string; active: boolean }) => {
    updateItem.mutate({ id: item.id, active: !item.active });
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.name.trim()) return;
    await updateItem.mutateAsync({ id: editingItem.id, name: editingItem.name.trim() });
    setEditingItem(null);
  };

  const [aiSummaryText,    setAiSummaryText]    = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryOpen,    setAiSummaryOpen]    = useState(false);
  const [aiSummaryAt,      setAiSummaryAt]      = useState<string | null>(null);

  const handleAiSummary = async () => {
    if (!id) return;
    setAiSummaryLoading(true);
    setAiSummaryOpen(true);
    try {
      const res = await projectsApi.aiSummary(id);
      setAiSummaryText(res.data.data.summary);
      setAiSummaryAt(res.data.data.generatedAt);
    } catch {
      setAiSummaryText('No se pudo generar el resumen. Intenta de nuevo.');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['project-summary', id],
    queryFn:  () => projectsApi.summary(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: expensesData } = useQuery({
    queryKey: ['expenses', 'project', id],
    queryFn:  () => expensesApi.list({ projectId: id, limit: 20, status: 'ACTIVE', orderBy: 'expenseDate', order: 'desc' }),
    select:   (r) => r.data,
    enabled:  !!id,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: projectData } = useQuery({
    queryKey: ['project', id],
    queryFn:  () => projectsApi.getById(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const { data: quotationsData } = useQuery({
    queryKey: ['quotations', 'project', id],
    queryFn:  () => quotationsApi.list({ projectId: id, limit: 5, orderBy: 'quotationDate', order: 'desc' }),
    select:   (r) => r.data,
    enabled:  !!id,
  });

  if (isLoading) {
    const meta = PAGE_META['/projects'];
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
          <DetailPageSkeleton sections={4} />
        </div>
      </div>
    );
  }
  if (!summaryData) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <span className="text-gray-400 text-sm">Proyecto no encontrado</span>
    </div>
  );

  const { project, summary, byCategory, addendums = [] } = summaryData;
  const expenses   = expensesData?.data ?? [];
  const quotations = quotationsData?.data ?? [];
  const usedPct    = Math.min(summary.budgetUsedPct, 100);
  const barColor = usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-green-500';
  const statusStyle = STATUS_INDUSTRIAL[project.status] ?? { bg: 'bg-gray-800', text: 'text-gray-400', label: project.status };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero header band */}
      <div className="bg-[#1C1C1C]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-5">

          {/* Breadcrumb */}
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 text-sm text-[#F5C218] hover:text-white transition-colors mb-4"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Proyectos
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1
                  className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight truncate"
                >
                  {project.name}
                </h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider ${statusStyle.bg} ${statusStyle.text}`}
                  style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                >
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
              </div>
              <p
                className="text-sm"
                style={{ fontFamily: "'Space Mono', monospace", color: '#F5C218' }}
              >
                {project.code}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleAiSummary}
                disabled={aiSummaryLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 bg-[#F5C218] text-[#1C1C1C] hover:bg-[#e6b400]"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {aiSummaryLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
                  : <><Sparkles className="w-4 h-4" /> Resumen IA</>
                }
              </button>
              {canEdit && (
                <>
                  <Link
                    to={`/projects/import-batches`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-600 text-gray-300 hover:border-[#F5C218] hover:text-white transition-colors"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <Upload className="w-4 h-4" /> Importar
                  </Link>
                  <Link
                    to={`/projects/${id}/financial`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-600 text-gray-300 hover:border-[#F5C218] hover:text-white transition-colors"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <BarChart2 className="w-4 h-4" /> Análisis financiero
                  </Link>
                  <Link
                    to={`/projects/${id}/edit`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-600 text-gray-300 hover:border-[#F5C218] hover:text-white transition-colors"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-4xl mx-auto px-4 md:px-5 py-4 md:py-5 space-y-5">

        {/* Project info card */}
        {projectData && (
          <div className="bg-white border border-gray-200 p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {projectData.client && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p
                      className="text-xs uppercase tracking-wide text-gray-500 mb-0.5"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      Cliente
                    </p>
                    <p
                      className="font-medium text-gray-800"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {projectData.client}
                    </p>
                  </div>
                </div>
              )}
              {projectData.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p
                      className="text-xs uppercase tracking-wide text-gray-500 mb-0.5"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      Ubicación
                    </p>
                    <p
                      className="font-medium text-gray-800"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {projectData.location}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p
                    className="text-xs uppercase tracking-wide text-gray-500 mb-0.5"
                    style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                  >
                    Inicio
                  </p>
                  <p
                    className="font-medium text-gray-800"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    {fmtDate(projectData.startDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Receipt className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p
                    className="text-xs uppercase tracking-wide text-gray-500 mb-0.5"
                    style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                  >
                    Gastos
                  </p>
                  {projectData.batchesEnabled ? (
                    <div className="space-y-1 mt-1">
                      {summaryData?.byItem ? (
                        summaryData.byItem.map((item: any) => (
                          <div key={item.itemId} className="text-sm">
                            <p
                              className="font-medium text-gray-800"
                              style={{ fontFamily: "'Space Mono', monospace" }}
                            >
                              {item.itemCode}: {fmt(item.totalAmount)}
                            </p>
                            <p
                              className="text-xs text-gray-400"
                              style={{ fontFamily: "'DM Sans', sans-serif" }}
                            >
                              {item.count} registros
                            </p>
                          </div>
                        ))
                      ) : (
                        <p
                          className="font-medium text-gray-800"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          {summary.expenseCount} registros
                        </p>
                      )}
                    </div>
                  ) : (
                    <p
                      className="font-medium text-gray-800"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {summary.expenseCount} registros
                    </p>
                  )}
                </div>
              </div>
            </div>
            {projectData.notes && (
              <p
                className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {projectData.notes}
              </p>
            )}
          </div>
        )}

        {/* AI Summary panel */}
        {aiSummaryOpen && (
          <div className="bg-[#1C1C1C] border border-[#F5C218]/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setAiSummaryOpen((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F5C218]" />
                <span
                  className="font-semibold text-[#F5C218] text-sm"
                  style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                >
                  Resumen ejecutivo IA
                </span>
                {aiSummaryAt && (
                  <span
                    className="text-xs text-gray-400"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    — generado {new Date(aiSummaryAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!aiSummaryLoading && aiSummaryText && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleAiSummary(); }}
                    className="text-[#F5C218]/60 hover:text-[#F5C218] p-1 hover:bg-white/10"
                    title="Regenerar"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                {aiSummaryOpen
                  ? <ChevronUp className="w-4 h-4 text-[#F5C218]/60" />
                  : <ChevronDown className="w-4 h-4 text-[#F5C218]/60" />
                }
              </div>
            </button>
            <div className="px-5 py-4 border-t border-[#F5C218]/20">
              {aiSummaryLoading ? (
                <div className="flex items-center gap-3 text-[#F5C218] py-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <p
                    className="text-sm"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Analizando datos del proyecto con IA...
                  </p>
                </div>
              ) : (
                <p
                  className="text-sm text-gray-300 leading-relaxed whitespace-pre-line"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {aiSummaryText}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Financial summary */}
        <div className="bg-white border border-gray-200 p-5 space-y-4">
          <h2
            className="font-['Barlow_Condensed'] text-base uppercase tracking-widest text-[#1C1C1C] flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4 text-[#F5C218]" />
            Resumen financiero
          </h2>

          {/* 3-stat grid with gap-px divider technique */}
          <div
            className="grid grid-cols-3 gap-px"
            style={{ background: '#e5e7eb' }}
          >
            <div className="bg-white p-3 text-center">
              <p
                className="text-xs text-gray-500 mb-1 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Presupuesto{addendums.length > 0 ? ' total' : ''}
              </p>
              <p
                className="text-lg font-bold text-[#1C1C1C]"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {fmt(project.totalBudget ?? project.estimatedBudget)}
              </p>
              {addendums.length > 0 && (
                <p
                  className="text-xs text-gray-400 mt-0.5"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  Base + {addendums.length} adenda{addendums.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="bg-white p-3 text-center">
              <p
                className="text-xs text-gray-500 mb-1 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Gastado
              </p>
              <p
                className="text-lg font-bold text-red-700"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {fmt(summary.totalSpent)}
              </p>
            </div>
            <div className="bg-white p-3 text-center">
              <p
                className="text-xs text-gray-500 mb-1 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Disponible
              </p>
              <p
                className={`text-lg font-bold ${summary.budgetRemaining >= 0 ? 'text-green-700' : 'text-red-700'}`}
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {fmt(Math.abs(summary.budgetRemaining))}
                {summary.budgetRemaining < 0 && (
                  <span
                    className="text-xs ml-1"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    (exceso)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Addendums breakdown */}
          {addendums.length > 0 && (
            <div className="border border-gray-200 divide-y divide-gray-100">
              <div className="flex justify-between px-3 py-2">
                <span
                  className="text-xs text-gray-500"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Presupuesto base
                </span>
                <span
                  className="text-xs font-medium text-gray-700"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {fmt(project.estimatedBudget)}
                </span>
              </div>
              {addendums.map((a: any) => (
                <div key={a.id} className="flex justify-between px-3 py-2">
                  <span
                    className="text-xs text-gray-500"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Adenda #{a.number} — {a.description}
                  </span>
                  <span
                    className="text-xs font-medium text-green-700"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    + {fmt(a.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span
                className="text-xs text-gray-500 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Presupuesto utilizado
              </span>
              <span
                className="text-xs font-semibold text-gray-700"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {summary.budgetUsedPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${usedPct >= 90 ? '' : barColor}`}
                style={{
                  width: `${usedPct}%`,
                  ...(usedPct >= 90 ? { background: '#F5C218' } : {}),
                }}
              />
            </div>
            {summary.budgetUsedPct >= 90 && (
              <div
                className="flex items-center gap-1.5 mt-2 text-xs text-red-600 border-l-4 border-red-400 pl-2"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <AlertCircle className="w-3 h-3" />
                Presupuesto casi agotado ({summary.budgetUsedPct.toFixed(1)}% utilizado)
              </div>
            )}
          </div>

          {/* By category — with optional sub-budgets */}
          {byCategory.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-gray-500 font-['Barlow_Condensed']">
                  Gastos por categoría
                </p>
                {canManageBudgets && (
                  <span className="text-[10px] text-gray-400 font-['DM_Sans']">click para asignar presupuesto</span>
                )}
              </div>
              <div className="space-y-3">
                {byCategory.sort((a, b) => b.totalAmount - a.totalAmount).map((bc) => {
                  const catBudget = categoryBudgets.find((cb) => cb.categoryId === bc.category?.id);
                  const hasBudget = !!catBudget;
                  const spent     = bc.totalAmount;
                  const budget    = catBudget?.budget ?? 0;
                  const pctOfTotal = summary.totalSpent > 0 ? (spent / summary.totalSpent) * 100 : 0;
                  const pctOfBudget = hasBudget && budget > 0 ? Math.min((spent / budget) * 100, 100) : pctOfTotal;
                  const barColor   = hasBudget && budget > 0
                    ? (spent / budget >= 1 ? '#ef4444' : spent / budget >= 0.85 ? '#f59e0b' : '#22c55e')
                    : '#F5C218';
                  const isEditingThis = cbEditing?.categoryId === bc.category?.id;

                  return (
                    <div key={bc.category?.id}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1 items-center gap-2">
                        <span className="font-medium font-['DM_Sans'] flex items-center gap-1.5">
                          {bc.category?.name}
                          {hasBudget && budget > 0 && spent / budget >= 0.85 && (
                            <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                          )}
                          {hasBudget && spent > budget && (
                            <span className="text-[10px] text-red-500 font-bold font-['Barlow_Condensed'] uppercase">SOBREGIRO</span>
                          )}
                        </span>
                        <span className="font-['Space_Mono'] shrink-0 flex items-center gap-2">
                          {hasBudget
                            ? <>{fmt(spent)} / <span className="text-gray-400">{fmt(budget)}</span></>
                            : <>{fmt(spent)} · {pctOfTotal.toFixed(0)}%</>
                          }
                          {canManageBudgets && !isEditingThis && (
                            <button
                              onClick={() => setCbEditing({ categoryId: bc.category!.id, budget: hasBudget ? String(budget) : '' })}
                              className="text-gray-300 hover:text-[#F5C218] transition-colors ml-1">
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                          {canManageBudgets && hasBudget && !isEditingThis && (
                            <button
                              onClick={() => deleteCbMut.mutate(bc.category!.id)}
                              className="text-gray-300 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      </div>
                      {isEditingThis && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            value={cbEditing.budget}
                            onChange={(e) => setCbEditing({ ...cbEditing, budget: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') upsertCbMut.mutate({ categoryId: cbEditing.categoryId, budget: Number(cbEditing.budget) });
                              if (e.key === 'Escape') setCbEditing(null);
                            }}
                            placeholder="Presupuesto DOP"
                            className="text-xs border border-[#F5C218] px-2 py-1 w-36 focus:outline-none font-['Space_Mono']"
                          />
                          <button onClick={() => upsertCbMut.mutate({ categoryId: cbEditing.categoryId, budget: Number(cbEditing.budget) })}
                            className="px-2 py-1 bg-[#F5C218] text-[#1C1C1C] text-xs font-bold uppercase hover:bg-yellow-300 transition-colors">
                            OK
                          </button>
                          <button onClick={() => setCbEditing(null)}
                            className="px-2 py-1 border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors">
                            ✕
                          </button>
                        </div>
                      )}
                      <div className="h-2 bg-gray-100 overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${pctOfBudget}%`, background: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Categories with budget but no expenses yet */}
              {categoryBudgets.filter((cb) => !byCategory.find((bc) => bc.category?.id === cb.categoryId)).map((cb) => (
                <div key={cb.id} className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1 items-center gap-2">
                    <span className="font-['DM_Sans']">{cb.category.name}</span>
                    <span className="font-['Space_Mono'] flex items-center gap-2">
                      {fmt(0)} / <span className="text-gray-400">{fmt(cb.budget)}</span>
                      {canManageBudgets && (
                        <button onClick={() => deleteCbMut.mutate(cb.categoryId)}
                          className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100" />
                </div>
              ))}

              {/* Add new category budget */}
              {canManageBudgets && (
                <div className="mt-3">
                  {cbNewCatId ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        value={cbNewBudget}
                        onChange={(e) => setCbNewBudget(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && cbNewBudget) upsertCbMut.mutate({ categoryId: Number(cbNewCatId), budget: Number(cbNewBudget) });
                          if (e.key === 'Escape') { setCbNewCatId(''); setCbNewBudget(''); }
                        }}
                        placeholder="Presupuesto DOP"
                        className="text-xs border border-[#F5C218] px-2 py-1 w-32 focus:outline-none font-['Space_Mono']"
                      />
                      <button onClick={() => cbNewBudget && upsertCbMut.mutate({ categoryId: Number(cbNewCatId), budget: Number(cbNewBudget) })}
                        className="px-2 py-1 bg-[#F5C218] text-[#1C1C1C] text-xs font-bold uppercase hover:bg-yellow-300 transition-colors">
                        OK
                      </button>
                      <button onClick={() => { setCbNewCatId(''); setCbNewBudget(''); }}
                        className="px-2 py-1 border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors">✕</button>
                    </div>
                  ) : (
                    <select
                      value=""
                      onChange={(e) => setCbNewCatId(e.target.value)}
                      className="text-xs border border-dashed border-gray-300 px-2 py-1 text-gray-400 focus:outline-none focus:border-[#F5C218] font-['DM_Sans'] cursor-pointer"
                    >
                      <option value="">+ Asignar presupuesto a categoría…</option>
                      {byCategory
                        .filter((bc) => bc.category && !categoryBudgets.find((cb) => cb.categoryId === bc.category!.id))
                        .map((bc) => (
                          <option key={bc.category!.id} value={bc.category!.id}>{bc.category!.name}</option>
                        ))
                      }
                    </select>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quotations */}
        <div className="bg-white border border-gray-200">
          {/* Card header — dark band */}
          <div
            className="flex items-center justify-between px-5 py-4 bg-[#1C1C1C]"
          >
            <h2
              className="font-['Barlow_Condensed'] text-base uppercase tracking-widest text-white flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-[#F5C218]" />
              Cotizaciones
              {quotationsData?.pagination?.total != null && quotationsData.pagination.total > 0 && (
                <span
                  className="text-xs px-2 py-0.5 font-medium"
                  style={{
                    background: 'rgba(245,194,24,0.15)',
                    color: '#F5C218',
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  {quotationsData.pagination.total}
                </span>
              )}
            </h2>
            <Link
              to={`/quotations/new?projectId=${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-600 text-gray-300 hover:border-[#F5C218] hover:text-white transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <Plus className="w-3.5 h-3.5" /> Nueva cotización
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {quotations.length === 0 ? (
              <p
                className="text-center text-gray-400 py-6 text-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                No hay cotizaciones en este proyecto
              </p>
            ) : (
              quotations.map((q) => (
                <Link
                  key={q.id}
                  to={`/quotations/${q.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group border-l-4 border-l-transparent hover:border-l-[#F5C218]"
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium text-gray-900 truncate group-hover:text-[#1C1C1C]"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {q.supplierName}
                      {q.quotationNumber && (
                        <span
                          className="text-xs text-gray-400 ml-1"
                          style={{ fontFamily: "'Space Mono', monospace" }}
                        >
                          #{q.quotationNumber}
                        </span>
                      )}
                    </p>
                    <p
                      className="text-xs text-gray-400 truncate"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {q.description.slice(0, 60)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p
                      className="text-sm font-bold text-gray-900"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {new Intl.NumberFormat('es-DO', { style: 'currency', currency: q.currency, minimumFractionDigits: 0 }).format(Number(q.total))}
                    </p>
                    <span className={`inline-flex text-xs px-2 py-0.5 font-medium ${QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}`}>
                      {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              ))
            )}
          </div>

          {(quotationsData?.pagination?.total ?? 0) > 5 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <Link
                to={`/quotations?projectId=${id}`}
                className="text-sm font-medium text-[#F5C218] hover:text-[#e6b400] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Ver todas las cotizaciones →
              </Link>
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-white border border-gray-200">
          {/* Card header — dark band */}
          <div
            className="flex items-center justify-between px-5 py-4 bg-[#1C1C1C]"
          >
            <h2
              className="font-['Barlow_Condensed'] text-base uppercase tracking-widest text-white"
            >
              Gastos recientes
            </h2>
            <Link
              to={`/expenses/new`}
              state={{ projectId: id }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors bg-[#F5C218] text-[#1C1C1C] hover:bg-[#e6b400]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo gasto
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {expenses.length === 0 ? (
              <p
                className="text-center text-gray-400 py-8 text-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                No hay gastos registrados
              </p>
            ) : (
              expenses.map((e) => (
                <Link
                  key={e.id}
                  to={`/expenses/${e.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  {/* Left status bar */}
                  <div
                    className="w-1 self-stretch shrink-0"
                    style={{ background: '#22c55e', minHeight: '2rem' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p
                        className="text-sm font-medium text-gray-900 truncate group-hover:text-[#1C1C1C]"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {e.description}
                      </p>
                      {(e as any).batchItem && (
                        <span
                          className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase"
                          style={{
                            fontFamily: "'Space Mono', monospace",
                            background: '#F5C218',
                            color: '#1C1C1C',
                          }}
                        >
                          {(e as any).batchItem.code}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs text-gray-400"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                      {e.hasFiscalDoc && e.fiscalVoucher && (
                        <span
                          className="text-blue-600 ml-1"
                          style={{ fontFamily: "'Space Mono', monospace" }}
                        >
                          · {e.fiscalVoucher.ncf}
                        </span>
                      )}
                      {e.hasFiscalDoc && !e.fiscalVoucher && (
                        <span className="text-blue-500 ml-1">· NCF</span>
                      )}
                      {e.paymentOrder?.paymentBank && (
                        <span
                          className="ml-1 text-gray-500"
                          style={{ fontFamily: "'Space Mono', monospace" }}
                        >
                          · {e.paymentOrder.paymentBank}
                        </span>
                      )}
                      {e.paymentOrder?.paymentReference && (
                        <span
                          className="ml-1 text-gray-400"
                          style={{ fontFamily: "'Space Mono', monospace" }}
                        >
                          #{e.paymentOrder.paymentReference}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-sm font-bold text-gray-900"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {fmt(Number(e.amount))}
                    </p>
                    <p
                      className="text-xs text-gray-400"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {fmtDate(e.expenseDate)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>

          {(expensesData?.pagination?.total ?? 0) > 20 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <Link
                to={`/expenses?projectId=${id}`}
                className="text-sm font-medium text-[#F5C218] hover:text-[#e6b400] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Ver todos los gastos →
              </Link>
            </div>
          )}
        </div>

      {/* ── Items del proyecto ─────────────────────────────────── */}
      <div className="mt-8 bg-white border border-gray-200">
        <div className="bg-[#1C1C1C] px-5 py-3 flex items-center justify-between">
          <h2 className="font-['Barlow_Condensed'] text-sm font-bold text-white uppercase tracking-[0.15em]">
            Items del Proyecto
            <span className="ml-2 font-['Space_Mono'] text-[#F5C218] text-xs">{items.length}</span>
          </h2>
          <span className="text-xs text-gray-400 font-['DM_Sans']">Partidas / lotes de licitación</span>
        </div>

        {/* Add item form — admin/supervisor only */}
        {canEdit && (
          <form onSubmit={handleCreateItem} className="flex gap-2 px-5 py-3 border-b border-gray-100">
            <input
              ref={itemInputRef}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Nombre del nuevo item…"
              className="flex-1 border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
            />
            <button
              type="submit"
              disabled={!itemName.trim() || createItem.isPending}
              className="px-4 py-2 bg-[#F5C218] text-[#1C1C1C] text-sm font-bold font-['Barlow_Condensed'] uppercase tracking-wide disabled:opacity-40"
            >
              {createItem.isPending ? '…' : 'Agregar'}
            </button>
          </form>
        )}

        {items.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400 font-['DM_Sans']">
            No hay items definidos. {canEdit ? 'Agrega el primero arriba.' : ''}
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-2 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.12em] w-12">#</th>
                    <th className="px-5 py-2 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.12em]">Nombre</th>
                    <th className="px-5 py-2 text-right font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.12em]">Registros</th>
                    {canEdit && <th className="px-5 py-2 w-24"></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={`border-b border-gray-50 ${!item.active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-2 font-['Space_Mono'] text-xs text-gray-500">{item.number}</td>
                      <td className="px-5 py-2 font-['DM_Sans']">
                        {editingItem?.id === item.id ? (
                          <form onSubmit={handleSaveEditItem} className="flex gap-2">
                            <input
                              value={editingItem.name}
                              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                              autoFocus
                              className="flex-1 border border-[#F5C218] px-2 py-1 text-sm font-['DM_Sans'] focus:outline-none"
                            />
                            <button type="submit" className="text-xs text-[#F5C218] font-bold px-2">Guardar</button>
                            <button type="button" onClick={() => setEditingItem(null)} className="text-xs text-gray-400 px-1">✕</button>
                          </form>
                        ) : (
                          <span className={!item.active ? 'line-through text-gray-400' : ''}>{item.name}</span>
                        )}
                      </td>
                      <td className="px-5 py-2 text-right font-['Space_Mono'] text-xs text-gray-500">
                        {item._count ? (item._count.expenses + item._count.paymentOrders + item._count.payrolls + item._count.quotations) : '—'}
                      </td>
                      {canEdit && (
                        <td className="px-5 py-2 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingItem({ id: item.id, name: item.name })}
                              className="text-xs text-gray-400 hover:text-[#F5C218] transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggleActive(item)}
                              disabled={updateItem.isPending}
                              className={`text-xs transition-colors ${item.active ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-600'}`}
                            >
                              {item.active ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className={`px-4 py-3 ${!item.active ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-['Space_Mono'] text-xs text-gray-400 shrink-0">#{item.number}</span>
                      {editingItem?.id === item.id ? (
                        <form onSubmit={handleSaveEditItem} className="flex gap-2 flex-1">
                          <input
                            value={editingItem.name}
                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                            autoFocus
                            className="flex-1 border border-[#F5C218] px-2 py-1 text-sm font-['DM_Sans'] focus:outline-none"
                          />
                          <button type="submit" className="text-xs text-[#F5C218] font-bold px-2">OK</button>
                          <button type="button" onClick={() => setEditingItem(null)} className="text-xs text-gray-400 px-1">✕</button>
                        </form>
                      ) : (
                        <span className={`font-['DM_Sans'] text-sm ${!item.active ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-['Space_Mono'] text-xs text-gray-400">
                        {item._count ? (item._count.expenses + item._count.paymentOrders + item._count.payrolls + item._count.quotations) : '—'}
                      </span>
                      {canEdit && !editingItem && (
                        <div className="flex gap-2">
                          <button onClick={() => setEditingItem({ id: item.id, name: item.name })} className="text-xs text-gray-400 hover:text-[#F5C218]">Editar</button>
                          <button onClick={() => handleToggleActive(item)} disabled={updateItem.isPending} className={`text-xs ${item.active ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-600'}`}>
                            {item.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Suplidores asignados */}
      <div className="bg-white border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em]">
            Suplidores Asignados
          </h2>
          {canManageSuppliers && (
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={() => { setShowSuggestions((v) => !v); if (!showSuggestions) fetchSuggestions(); }}
                className="flex items-center gap-1 text-xs border border-[#F5C218] text-[#F5C218] px-3 py-1 font-bold uppercase font-['Barlow_Condensed'] hover:bg-[#F5C218] hover:text-[#1C1C1C] transition-colors"
              >
                <Sparkles size={12} /> IA
              </button>
              <button
                onClick={() => importMut.mutate()}
                disabled={importMut.isPending}
                className="flex items-center gap-1 text-xs border border-gray-300 text-gray-600 px-3 py-1 font-bold uppercase font-['Barlow_Condensed'] hover:border-gray-500 disabled:opacity-50"
              >
                <Download size={12} /> {importMut.isPending ? 'Importando…' : 'Importar'}
              </button>
              <button
                onClick={() => setShowAddSupplier(true)}
                className="flex items-center gap-1 text-xs bg-[#F5C218] text-[#1C1C1C] px-3 py-1 font-bold uppercase font-['Barlow_Condensed']"
              >
                <UserPlus size={12} /> Agregar
              </button>
            </div>
          )}
        </div>

        {showAddSupplier && (
          <div className="flex flex-col gap-2 mb-4">
            <select
              value={addSupplierId}
              onChange={(e) => setAddSupplierId(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218]"
            >
              <option value="">— Seleccionar suplidor —</option>
              {allSuppliers
                .filter((s) => !assignedSuppliers.some((a) => a.supplierId === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.rnc ? ` (${s.rnc})` : ''}</option>
                ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => addSupplierId && assignMut.mutate(addSupplierId)}
                disabled={!addSupplierId || assignMut.isPending}
                className="flex-1 py-2 text-xs font-bold uppercase font-['Barlow_Condensed'] bg-[#F5C218] text-[#1C1C1C] disabled:opacity-50"
              >
                {assignMut.isPending ? 'Asignando…' : 'Asignar'}
              </button>
              <button
                onClick={() => { setShowAddSupplier(false); setAddSupplierId(''); }}
                className="px-4 py-2 text-xs border border-gray-200 text-gray-600 font-['Barlow_Condensed'] uppercase"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* AI Suggestions Panel */}
        {showSuggestions && (
          <div className="mb-4 border border-[#F5C218]/30 bg-[#F5C218]/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase text-gray-600 tracking-[0.1em] flex items-center gap-1">
                <Sparkles size={11} /> Sugerencias IA
              </p>
              <button onClick={() => setShowSuggestions(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
            {suggestionsLoading ? (
              <p className="text-xs text-gray-400 font-['DM_Sans']">Analizando historial de pagos…</p>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-gray-400 font-['DM_Sans']">Sin sugerencias. Agrega más pagos al proyecto para mejorar las sugerencias.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {suggestions.map((s) => (
                  <div key={s.supplierId} className="flex items-start justify-between gap-3 bg-white border border-gray-100 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold font-['DM_Sans'] text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500 font-['DM_Sans'] mt-0.5">{s.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold font-['Barlow_Condensed'] uppercase px-2 py-0.5 ${
                        s.confidence === 'HIGH'   ? 'bg-green-100 text-green-700' :
                        s.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-gray-100 text-gray-500'
                      }`}>
                        {s.confidence === 'HIGH' ? 'Alta' : s.confidence === 'MEDIUM' ? 'Media' : 'Baja'}
                      </span>
                      <button
                        onClick={() => assignMut.mutate(s.supplierId)}
                        disabled={assignMut.isPending}
                        className="text-xs bg-[#F5C218] text-[#1C1C1C] px-2 py-1 font-bold uppercase font-['Barlow_Condensed'] disabled:opacity-50"
                      >
                        Asignar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {assignedSuppliers.length === 0 ? (
          <p className="text-sm text-gray-400 font-['DM_Sans']">Sin suplidores asignados</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1C1C1C]">
                    {['Nombre', 'RNC', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.1em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignedSuppliers.map((a) => (
                    <tr key={a.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-['DM_Sans']">{a.supplier.name}</td>
                      <td className="px-3 py-2 font-['Space_Mono'] text-xs text-gray-500">{a.supplier.rnc ?? '—'}</td>
                      <td className="px-3 py-2">
                        {canManageSuppliers && (
                          <button
                            onClick={() => removeMut.mutate(a.supplierId)}
                            disabled={removeMut.isPending}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {assignedSuppliers.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-1 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-['DM_Sans'] text-sm text-gray-800 truncate">{a.supplier.name}</p>
                    <p className="font-['Space_Mono'] text-xs text-gray-400 mt-0.5">{a.supplier.rnc ?? '—'}</p>
                  </div>
                  {canManageSuppliers && (
                    <button
                      onClick={() => removeMut.mutate(a.supplierId)}
                      disabled={removeMut.isPending}
                      className="text-red-400 hover:text-red-600 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      </div>
    </div>
  );
}
