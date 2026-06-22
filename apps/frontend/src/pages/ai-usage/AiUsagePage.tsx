import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { aiUsageApi } from '../../api/index';

// ── Month helpers ──────────────────────────────────────────────
const MONTHS_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return `${MONTHS_ES[parseInt(month) - 1]} ${year}`;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

function initMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

// ── Format helpers ─────────────────────────────────────────────
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

// ── Feature labels ─────────────────────────────────────────────
const FEATURE_LABELS: Record<string, string> = {
  OCR: 'OCR de Facturas',
  WHATSAPP: 'Chatbot WhatsApp',
  AI_SUMMARY: 'Resumen IA',
  SUGGEST_CATEGORY: 'Sugerir Categoría',
  SUGGEST_CONCEPT: 'Sugerir Concepto',
  MONITORING: 'Monitoreo IA',
  SUPPLIER_SUGGESTIONS: 'Sugerencias Suplidores',
};

// ── Component ──────────────────────────────────────────────────
export default function AiUsagePage() {
  const [selectedMonth, setSelectedMonth] = useState(initMonth);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState('');

  const queryClient = useQueryClient();

  const { data: summaryRes, isLoading: loadingSummary } = useQuery({
    queryKey: ['ai-usage-summary', selectedMonth],
    queryFn: () => aiUsageApi.getSummary(selectedMonth),
  });
  const summary = summaryRes?.data?.data;

  const { data: byFeatureRes, isLoading: loadingFeature } = useQuery({
    queryKey: ['ai-usage-by-feature', selectedMonth],
    queryFn: () => aiUsageApi.getByFeature(selectedMonth),
  });
  const byFeature = byFeatureRes?.data?.data ?? [];

  const { data: byUserRes, isLoading: loadingUser } = useQuery({
    queryKey: ['ai-usage-by-user', selectedMonth],
    queryFn: () => aiUsageApi.getByUser(selectedMonth),
  });
  const byUser = byUserRes?.data?.data ?? [];

  const { data: alertRes } = useQuery({
    queryKey: ['ai-usage-alert'],
    queryFn: () => aiUsageApi.getAlert(),
  });
  const alert = alertRes?.data?.data;

  const updateAlertMutation = useMutation({
    mutationFn: ({ limit, enabled }: { limit: number; enabled: boolean }) =>
      aiUsageApi.updateAlert(limit, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-usage-alert'] });
      setEditingLimit(false);
    },
  });

  const currentCost = summary?.totalCostUsd ?? 0;
  const limitUsd = alert?.monthlyLimitUsd ?? 50;
  const progressPct = Math.min(100, (currentCost / limitUsd) * 100);
  const isOverLimit = progressPct >= 90;

  function handleSaveLimit() {
    const parsed = parseFloat(limitInput);
    if (!isNaN(parsed) && parsed > 0) {
      updateAlertMutation.mutate({ limit: parsed, enabled: alert?.enabled ?? true });
    }
  }

  function handleToggleEnabled() {
    if (alert) {
      updateAlertMutation.mutate({ limit: alert.monthlyLimitUsd, enabled: !alert.enabled });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HERO */}
      <div className="bg-[#1C1C1C] px-6 py-8">
        <p className="text-[#F5C218] text-xs font-['Barlow_Condensed'] uppercase tracking-[0.2em] mb-2">
          Administración / IA
        </p>
        <div className="flex items-end justify-between">
          <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight">
            CONSUMO DE IA
          </h1>
          {/* Month selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedMonth(prevMonth(selectedMonth))}
              className="text-gray-400 hover:text-[#F5C218] transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-['Barlow_Condensed'] text-white text-lg uppercase tracking-widest min-w-[160px] text-center">
              {formatMonth(selectedMonth)}
            </span>
            <button
              onClick={() => setSelectedMonth(nextMonth(selectedMonth))}
              className="text-gray-400 hover:text-[#F5C218] transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-8">
        {/* KPI CARDS */}
        {loadingSummary ? (
          <p className="text-gray-400 font-['DM_Sans']">Cargando...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Input Tokens */}
            <div className="bg-white border border-gray-200 p-6">
              <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-[0.15em] text-gray-500 mb-2">
                Input Tokens
              </p>
              <p className="font-['Space_Mono'] text-2xl font-bold text-[#1C1C1C]">
                {fmtTokens(summary?.totalInputTokens ?? 0)}
              </p>
            </div>
            {/* Output Tokens */}
            <div className="bg-white border border-gray-200 p-6">
              <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-[0.15em] text-gray-500 mb-2">
                Output Tokens
              </p>
              <p className="font-['Space_Mono'] text-2xl font-bold text-[#1C1C1C]">
                {fmtTokens(summary?.totalOutputTokens ?? 0)}
              </p>
            </div>
            {/* Costo Est. USD */}
            <div className="bg-white border border-gray-200 p-6">
              <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-[0.15em] text-gray-500 mb-2">
                Costo Est. USD
              </p>
              <p className="font-['Space_Mono'] text-2xl font-bold text-[#1C1C1C]">
                {fmtUsd(summary?.totalCostUsd ?? 0)}
              </p>
            </div>
            {/* Total Llamadas */}
            <div className="bg-white border border-gray-200 p-6">
              <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-[0.15em] text-gray-500 mb-2">
                Total Llamadas
              </p>
              <p className="font-['Space_Mono'] text-2xl font-bold text-[#1C1C1C]">
                {summary?.totalCalls ?? 0}
              </p>
            </div>
          </div>
        )}

        {/* COST LIMIT SECTION */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-['Barlow_Condensed'] text-sm uppercase tracking-[0.15em] text-gray-500">
              Límite de Costo Mensual
            </p>
            {/* Enable/Disable toggle */}
            <div className="flex items-center gap-3">
              <span className="font-['DM_Sans'] text-sm text-gray-500">
                {alert?.enabled ? 'Activo' : 'Inactivo'}
              </span>
              <button
                onClick={handleToggleEnabled}
                disabled={!alert || updateAlertMutation.isPending}
                className={`relative inline-flex h-5 w-9 items-center transition-colors ${
                  alert?.enabled ? 'bg-[#F5C218]' : 'bg-gray-300'
                } disabled:opacity-50`}
              >
                <span
                  className={`inline-block h-3 w-3 transform bg-white transition-transform mx-1 ${
                    alert?.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Limit display/edit */}
          <div className="flex items-center gap-3 mb-4">
            {editingLimit ? (
              <>
                <span className="font-['DM_Sans'] text-sm text-gray-500">$</span>
                <input
                  type="number"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="border border-gray-200 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] px-2 py-1 font-['Space_Mono'] text-sm w-28 outline-none"
                  step="0.01"
                  min="0"
                />
                <button
                  onClick={handleSaveLimit}
                  disabled={updateAlertMutation.isPending}
                  className="bg-[#F5C218] text-[#1C1C1C] p-1 disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingLimit(false)}
                  className="border border-gray-200 text-gray-600 p-1"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span className="font-['Space_Mono'] text-xl font-bold text-[#1C1C1C]">
                  ${limitUsd.toFixed(2)}
                </span>
                <button
                  onClick={() => {
                    setLimitInput(String(alert?.monthlyLimitUsd ?? 50));
                    setEditingLimit(true);
                  }}
                  className="text-gray-400 hover:text-[#F5C218] transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-['DM_Sans'] text-gray-400">
              <span>{fmtUsd(currentCost)}</span>
              <span>{progressPct.toFixed(1)}%</span>
            </div>
            <div className="bg-gray-200 w-full h-2">
              <div
                className={`h-2 transition-all ${isOverLimit ? 'bg-red-500' : 'bg-[#F5C218]'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* BY-FEATURE TABLE */}
        <div className="bg-white border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-['Barlow_Condensed'] text-lg uppercase tracking-[0.1em] text-[#1C1C1C] font-bold">
              Por Funcionalidad
            </h2>
          </div>
          {loadingFeature ? (
            <p className="text-gray-400 font-['DM_Sans'] p-6">Cargando...</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#1C1C1C]">
                  <th className="text-left px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Feature
                  </th>
                  <th className="text-right px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Llamadas
                  </th>
                  <th className="text-right px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Input Tokens
                  </th>
                  <th className="text-right px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Output Tokens
                  </th>
                  <th className="text-right px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Costo USD
                  </th>
                  <th className="text-right px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    % Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {byFeature.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-400 font-['DM_Sans'] text-sm">
                      Sin datos para este mes
                    </td>
                  </tr>
                ) : (
                  byFeature.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-3 font-['DM_Sans'] text-sm text-[#1C1C1C]">
                        {FEATURE_LABELS[row.feature] ?? row.feature}
                      </td>
                      <td className="px-6 py-3 text-right font-['Space_Mono'] text-sm text-gray-700">
                        {row.calls}
                      </td>
                      <td className="px-6 py-3 text-right font-['Space_Mono'] text-sm text-gray-700">
                        {fmtTokens(row.inputTokens)}
                      </td>
                      <td className="px-6 py-3 text-right font-['Space_Mono'] text-sm text-gray-700">
                        {fmtTokens(row.outputTokens)}
                      </td>
                      <td className="px-6 py-3 text-right font-['Space_Mono'] text-sm text-gray-700">
                        {fmtUsd(row.costUsd)}
                      </td>
                      <td className="px-6 py-3 text-right font-['Space_Mono'] text-sm text-gray-700">
                        {row.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* BY-USER TABLE */}
        <div className="bg-white border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-['Barlow_Condensed'] text-lg uppercase tracking-[0.1em] text-[#1C1C1C] font-bold">
              Por Usuario
            </h2>
          </div>
          {loadingUser ? (
            <p className="text-gray-400 font-['DM_Sans'] p-6">Cargando...</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#1C1C1C]">
                  <th className="text-left px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Usuario
                  </th>
                  <th className="text-left px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Rol
                  </th>
                  <th className="text-right px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Llamadas
                  </th>
                  <th className="text-right px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Tokens
                  </th>
                  <th className="text-right px-6 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                    Costo USD
                  </th>
                </tr>
              </thead>
              <tbody>
                {byUser.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-400 font-['DM_Sans'] text-sm">
                      Sin datos para este mes
                    </td>
                  </tr>
                ) : (
                  byUser.map((row, i) => (
                    <tr key={row.userId ?? 'system'} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-3 font-['DM_Sans'] text-sm text-[#1C1C1C]">
                        {row.userId === null ? 'Sistema (cron)' : row.userName}
                      </td>
                      <td className="px-6 py-3 font-['DM_Sans'] text-sm text-gray-500">
                        {row.userRole ?? '-'}
                      </td>
                      <td className="px-6 py-3 text-right font-['Space_Mono'] text-sm text-gray-700">
                        {row.calls}
                      </td>
                      <td className="px-6 py-3 text-right font-['Space_Mono'] text-sm text-gray-700">
                        {fmtTokens(row.inputTokens + row.outputTokens)}
                      </td>
                      <td className="px-6 py-3 text-right font-['Space_Mono'] text-sm text-gray-700">
                        {fmtUsd(row.costUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
