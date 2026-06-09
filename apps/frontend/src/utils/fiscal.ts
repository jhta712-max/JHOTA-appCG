export const NCF_REGEX   = /^[A-Z]\d{10}$/;
export const E_NCF_REGEX = /^E\d{12}$/;
export const RNC_REGEX   = /^\d{9}(\d{2})?$/;

export function validateNCF(ncf: string): boolean {
  const upper = ncf.toUpperCase();
  return NCF_REGEX.test(upper) || E_NCF_REGEX.test(upper);
}

export function validateRNC(rnc: string): boolean {
  return RNC_REGEX.test(rnc);
}
