import { describe, it, expect } from 'vitest';
import { createExpenseSchema, updateExpenseSchema } from '../expenses.schema';

const validBase = {
  projectId:     '550e8400-e29b-41d4-a716-446655440000',
  categoryId:    1,
  expenseDate:   '2026-06-01',
  amount:        1500.5,
  description:   'Compra de cemento',
  paymentMethod: 'CASH' as const,
};

describe('createExpenseSchema', () => {
  it('acepta un gasto válido sin comprobante', () => {
    const r = createExpenseSchema.safeParse(validBase);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.hasFiscalDoc).toBe(false); // default
  });

  it('coerciona amount y categoryId desde string', () => {
    const r = createExpenseSchema.safeParse({ ...validBase, amount: '2500.75', categoryId: '3' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amount).toBe(2500.75);
      expect(r.data.categoryId).toBe(3);
    }
  });

  it('rechaza monto cero o negativo', () => {
    expect(createExpenseSchema.safeParse({ ...validBase, amount: 0 }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...validBase, amount: -10 }).success).toBe(false);
  });

  it('exige fiscalVoucher cuando hasFiscalDoc es true', () => {
    const r = createExpenseSchema.safeParse({ ...validBase, hasFiscalDoc: true });
    expect(r.success).toBe(false);
  });

  it('acepta comprobante fiscal completo y valida NCF/RNC', () => {
    const conComprobante = {
      ...validBase,
      hasFiscalDoc: true,
      fiscalVoucher: { ncf: 'B0100000001', supplierRnc: '123456789', supplierName: 'Ferretería X', itbisAmount: 270 },
    };
    expect(createExpenseSchema.safeParse(conComprobante).success).toBe(true);

    const ncfInvalido = { ...conComprobante, fiscalVoucher: { ...conComprobante.fiscalVoucher, ncf: 'XYZ123' } };
    expect(createExpenseSchema.safeParse(ncfInvalido).success).toBe(false);

    const rncInvalido = { ...conComprobante, fiscalVoucher: { ...conComprobante.fiscalVoucher, supplierRnc: '12345' } };
    expect(createExpenseSchema.safeParse(rncInvalido).success).toBe(false);
  });

  it('exige companyCardId cuando paymentMethod es CARD', () => {
    expect(createExpenseSchema.safeParse({ ...validBase, paymentMethod: 'CARD' }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...validBase, paymentMethod: 'CARD', companyCardId: 2 }).success).toBe(true);
  });

  it('rechaza fecha con formato inválido', () => {
    expect(createExpenseSchema.safeParse({ ...validBase, expenseDate: '01/06/2026' }).success).toBe(false);
  });
});

describe('updateExpenseSchema', () => {
  it('acepta actualización parcial (solo monto)', () => {
    expect(updateExpenseSchema.safeParse({ amount: 999 }).success).toBe(true);
  });

  it('no acepta projectId (omitido del schema de update)', () => {
    const r = updateExpenseSchema.safeParse({ projectId: validBase.projectId, amount: 100 });
    // projectId se ignora silenciosamente (strip), no debe aparecer en data
    expect(r.success).toBe(true);
    if (r.success) expect('projectId' in r.data).toBe(false);
  });
});
