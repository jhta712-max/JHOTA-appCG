/**
 * Utilidades de validación fiscal — DGII República Dominicana
 *
 * NCF Tradicional (papel):   [A-Z] + 10 dígitos = 11 chars  ej. B0100000001
 * e-NCF Electrónico (Ley 32-23): E + 12 dígitos = 13 chars  ej. E310000000001
 * RNC: 9 dígitos (personas físicas) u 11 dígitos (jurídicas)
 */

const NCF_REGEX   = /^[A-Z]\d{10}$/;    // 11 chars — NCF tradicional
const E_NCF_REGEX = /^E\d{12}$/;        // 13 chars — e-NCF electrónico
const RNC_REGEX   = /^\d{9}(\d{2})?$/;  // 9 u 11 dígitos

/** Valida si es NCF tradicional o e-NCF electrónico */
export function validateNCF(value: string): boolean {
  return NCF_REGEX.test(value) || E_NCF_REGEX.test(value);
}

/** Devuelve true si el NCF es electrónico (empieza con E) */
export function isElectronicNCF(value: string): boolean {
  return E_NCF_REGEX.test(value);
}

/** Extrae el código de tipo del NCF (B01, E31, etc.) */
export function extractNCFType(ncf: string): string {
  if (isElectronicNCF(ncf)) {
    // e-NCF: E + 2 dígitos tipo + 10 secuencial → tipo = posición 1-2
    return 'E' + ncf.substring(1, 3);  // ej. E31
  }
  // NCF tradicional: letra + 2 dígitos tipo + 8 secuencial → tipo = posición 0-2
  return ncf.substring(0, 3);  // ej. B01
}

/** Strips dashes, spaces and dots from an RNC/cédula string */
export function normalizeRNC(value: string): string {
  return value.replace(/[\s\-\.]/g, '');
}

/** Valida formato de RNC (9 u 11 dígitos). Acepta guiones — los elimina antes de validar. */
export function validateRNC(value: string): boolean {
  return RNC_REGEX.test(normalizeRNC(value));
}

/** Descripción del tipo e-NCF según DGII */
export const E_NCF_TYPES: Record<string, string> = {
  E31: 'Factura de Crédito Fiscal Electrónica',
  E32: 'Factura de Consumo Electrónica',
  E33: 'Nota de Débito Electrónica',
  E34: 'Nota de Crédito Electrónica',
  E41: 'Comprobante Electrónico de Compras',
  E43: 'Comprobante para Gastos Menores Electrónico',
  E44: 'Comprobante para Regímenes Especiales Electrónico',
  E45: 'Comprobante Gubernamental Electrónico',
  E46: 'Comprobante para Exportaciones Electrónico',
  E47: 'Comprobante para Pagos al Exterior Electrónico',
};

/** Descripción del tipo NCF tradicional */
export const NCF_TYPES: Record<string, string> = {
  B01: 'Crédito Fiscal',
  B02: 'Consumo',
  B03: 'Nota de Débito',
  B04: 'Nota de Crédito',
  B11: 'Proveedores Informales',
  B12: 'Únicos Ingresos',
  B13: 'Gastos Menores',
  B14: 'Regímenes Especiales',
  B15: 'Gubernamental',
  B16: 'Exportaciones',
  B17: 'Pagos al Exterior',
};
