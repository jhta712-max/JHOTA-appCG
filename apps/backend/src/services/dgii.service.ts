const DGII_BASE = process.env.DGII_API_URL ?? 'https://api.dgii.gov.do/api/contribuyentes';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h
const TIMEOUT_MS = 6_000;

export type DgiiResult =
  | { found: true;  rnc: string; name: string; status: string; category: string | null; unreachable?: false }
  | { found: false; rnc: string; unreachable?: boolean };

const cache = new Map<string, { result: DgiiResult; expiresAt: number }>();

export async function lookupRNC(rnc: string): Promise<DgiiResult> {
  const hit = cache.get(rnc);
  if (hit && hit.expiresAt > Date.now()) return hit.result;

  try {
    const ac  = new AbortController();
    const tid = setTimeout(() => ac.abort(), TIMEOUT_MS);

    const res = await fetch(
      `${DGII_BASE}/GetContribuyentes?value=${encodeURIComponent(rnc)}&itemsPerPage=1`,
      { signal: ac.signal },
    );
    clearTimeout(tid);

    if (!res.ok) {
      return { found: false, rnc, unreachable: true };
    }

    const text  = await res.text();
    // DGII response: "RNC|RAZON_SOCIAL|NOMBRE_COMERCIAL|CATEGORIA|REGIMEN_PAGO|ESTADO\n"
    const lines = text.trim().split('\n').filter(Boolean);

    if (!lines.length || !lines[0].includes('|')) {
      const result: DgiiResult = { found: false, rnc };
      cache.set(rnc, { result, expiresAt: Date.now() + CACHE_TTL });
      return result;
    }

    const parts  = lines[0].split('|');
    const result: DgiiResult = {
      found:    true,
      rnc:      parts[0]?.trim() ?? rnc,
      name:     parts[1]?.trim() ?? '',
      status:   parts[5]?.trim() ?? '',
      category: parts[3]?.trim() || null,
    };
    cache.set(rnc, { result, expiresAt: Date.now() + CACHE_TTL });
    return result;

  } catch {
    return { found: false, rnc, unreachable: true };
  }
}
