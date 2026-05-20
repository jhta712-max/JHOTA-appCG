/**
 * Formatea una fecha de la BD (ISO string o YYYY-MM-DD) sin corrección de zona horaria.
 * Evita el desplazamiento UTC que muestra un día menos en zonas UTC-4 (RD).
 *
 * Uso: fmtDate('2026-04-27') → '27/4/2026'
 *      fmtDate('2026-04-27T00:00:00.000Z', { month: 'long' }) → '27 de abril de 2026'
 */
export function fmtDate(
  d: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  if (!d) return '—';
  // Extrae solo YYYY-MM-DD y lo interpreta al mediodía local para evitar el salto de día UTC
  const localNoon = d.split('T')[0] + 'T12:00:00';
  return new Date(localNoon).toLocaleDateString('es-DO', opts);
}
