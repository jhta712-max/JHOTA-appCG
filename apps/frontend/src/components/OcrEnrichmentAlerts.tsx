import type { OcrEnrichmentResult } from '../api';

interface Props {
  enrichment: OcrEnrichmentResult | null;
}

export function OcrEnrichmentAlerts({ enrichment }: Props) {
  if (!enrichment) return null;

  const hasIssues =
    enrichment.ncfDuplicate ||
    enrichment.cotizacionAlert ||
    enrichment.warnings.length > 0;

  const hasPositives =
    enrichment.supplierMatch ||
    enrichment.ncfInfo;

  if (!hasIssues && !hasPositives) return null;

  return (
    <div className="space-y-2 mt-3">
      {/* Nivel 1: Proveedor encontrado en BD */}
      {enrichment.supplierMatch && (
        <div className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-800 text-xs">
          <span className="mt-0.5">✅</span>
          <span>
            <strong>Proveedor identificado:</strong> {enrichment.supplierMatch.name}
            {enrichment.supplierMatch.rnc && (
              <span className="text-green-600"> (RNC {enrichment.supplierMatch.rnc})</span>
            )}
            {' '}— se pre-seleccionará en el formulario.
          </span>
        </div>
      )}

      {/* Nivel 1: Tipo de comprobante */}
      {enrichment.ncfInfo && (
        <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs">
          <span className="mt-0.5">{enrichment.ncfInfo.isElectronic ? '🔵' : '📄'}</span>
          <span>
            <strong>{enrichment.ncfInfo.isElectronic ? 'e-NCF' : 'NCF'} {enrichment.ncfInfo.code}:</strong>{' '}
            {enrichment.ncfInfo.description}
            {enrichment.ncfInfo.itbisDeductible && (
              <span className="ml-1 text-blue-600">· ITBIS deducible</span>
            )}
          </span>
        </div>
      )}

      {/* Nivel 1: NCF duplicado — BLOQUEANTE */}
      {enrichment.ncfDuplicate && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-400 text-red-800 text-xs font-medium">
          <span className="mt-0.5">🚫</span>
          <span>
            <strong>NCF duplicado:</strong> Este comprobante ya fue registrado
            {enrichment.ncfDuplicate.expenseCode && (
              <> en el gasto <strong>{enrichment.ncfDuplicate.expenseCode}</strong></>
            )}{' '}
            el {enrichment.ncfDuplicate.date}. Verifica antes de guardar.
          </span>
        </div>
      )}

      {/* Nivel 1: Cotización superada */}
      {enrichment.cotizacionAlert && (
        <div className="flex items-start gap-2 px-3 py-2 bg-orange-50 border border-orange-300 text-orange-800 text-xs">
          <span className="mt-0.5">⚠️</span>
          <span>
            <strong>Supera cotización:</strong> La factura (RD ${enrichment.cotizacionAlert.invoiceAmt.toLocaleString('es-DO')}) excede la cotización{' '}
            <strong>{enrichment.cotizacionAlert.cotizacionCode}</strong>{' '}
            (RD ${enrichment.cotizacionAlert.cotizacionAmt.toLocaleString('es-DO')}) en{' '}
            <strong>{enrichment.cotizacionAlert.diffPct}%</strong>.
          </span>
        </div>
      )}

      {/* Nivel 2: Warnings suaves */}
      {enrichment.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-2 bg-yellow-50 border border-yellow-300 text-yellow-800 text-xs">
          <span className="mt-0.5">⚠️</span>
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}
