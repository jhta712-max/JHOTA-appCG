export const NCF_REGEX   = /^[A-Z]\d{10}$/;
export const E_NCF_REGEX = /^E\d{12}$/;
export const RNC_REGEX   = /^\d{9}(\d{2})?$/;

export function validateNCF(v: string): boolean {
  return NCF_REGEX.test(v) || E_NCF_REGEX.test(v);
}

export function validateRNC(v: string): boolean {
  return RNC_REGEX.test(v);
}
