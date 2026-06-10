export interface BcrdRateResult {
  currency: string;
  compra:   number | null;
  venta:    number | null;
  date:     string | null;
  fallback: boolean;
  source:   'bcrd' | 'fallback' | 'unavailable';
}

const BCRD_API_BASE = 'https://estadisticas.bcrd.gov.do/api/';

const SERIES: Record<string, { compra: string; venta: string }> = {
  USD: { compra: 'TC.MN.USD', venta: 'TC.MV.USD' },
  EUR: { compra: 'TC.MN.EUR', venta: 'TC.MV.EUR' },
};

async function fetchSeries(seriesCode: string): Promise<{ value: number; date: string } | null> {
  try {
    const url = `${BCRD_API_BASE}series/${encodeURIComponent(seriesCode)}/data?limit=1&order=desc`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const json = await res.json() as any;
    const rows = json?.data ?? json?.result ?? json?.observations ?? [];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row   = rows[0];
    const value = Number(row?.valor ?? row?.value ?? row?.obs_value);
    const date  = String(row?.fecha ?? row?.date ?? row?.time_period ?? '');

    if (!isFinite(value) || value <= 0) return null;
    return { value, date };
  } catch {
    return null;
  }
}

/** Fallback: exchangerate-api.com (free tier, no auth required) */
async function fetchFallbackRate(currency: string): Promise<{ rate: number; date: string } | null> {
  try {
    // Returns how many units of target currency per 1 USD
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json() as any;
    const date  = String(json?.date ?? new Date().toISOString().slice(0, 10));

    if (currency === 'USD') {
      const dop = Number(json?.rates?.DOP);
      if (!isFinite(dop) || dop <= 0) return null;
      return { rate: dop, date };
    } else if (currency === 'EUR') {
      // Convert: EUR→USD rate then USD→DOP
      const eurPerUsd = Number(json?.rates?.EUR);
      const dopPerUsd = Number(json?.rates?.DOP);
      if (!isFinite(eurPerUsd) || eurPerUsd <= 0 || !isFinite(dopPerUsd) || dopPerUsd <= 0) return null;
      const dopPerEur = dopPerUsd / eurPerUsd;
      return { rate: dopPerEur, date };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getBcrdRate(currency = 'USD'): Promise<BcrdRateResult> {
  const series = SERIES[currency.toUpperCase()] ?? SERIES['USD'];
  const cur    = currency.toUpperCase() in SERIES ? currency.toUpperCase() : 'USD';

  const [compraResult, ventaResult] = await Promise.all([
    fetchSeries(series.compra),
    fetchSeries(series.venta),
  ]);

  if (compraResult || ventaResult) {
    const date = ventaResult?.date ?? compraResult?.date ?? new Date().toISOString().slice(0, 10);
    return {
      currency: cur,
      compra:   compraResult?.value ?? null,
      venta:    ventaResult?.value  ?? null,
      date,
      fallback: false,
      source:   'bcrd',
    };
  }

  // BCRD unavailable — try exchangerate-api.com fallback
  const fallback = await fetchFallbackRate(cur);
  if (fallback) {
    return {
      currency: cur,
      compra:   fallback.rate,
      venta:    fallback.rate,
      date:     fallback.date,
      fallback: true,
      source:   'fallback',
    };
  }

  // Both sources failed
  return { currency: cur, compra: null, venta: null, date: null, fallback: true, source: 'unavailable' };
}
