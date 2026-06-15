import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../../middlewares/errorHandler';

vi.mock('../../../config/database', () => ({
  default: {
    supplier: { findUnique: vi.fn() },
    supplierCreditLine: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    supplierCreditPayment: { create: vi.fn(), findMany: vi.fn() },
    expense: { aggregate: vi.fn() },
  },
}));

import prisma from '../../../config/database';
import * as svc from '../credit-lines.service';

const SUPPLIER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID     = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LINE_ID     = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => vi.clearAllMocks());

describe('createCreditLine', () => {
  it('throws 404 if supplier not found', async () => {
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue(null);
    await expect(svc.createCreditLine(SUPPLIER_ID, { creditLimit: 300000 }, USER_ID))
      .rejects.toThrow(AppError);
  });

  it('creates credit line for existing supplier', async () => {
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue({ id: SUPPLIER_ID } as any);
    vi.mocked(prisma.supplierCreditLine.create).mockResolvedValue({
      id: LINE_ID, supplierId: SUPPLIER_ID, creditLimit: 300000, isActive: true,
    } as any);

    const result = await svc.createCreditLine(SUPPLIER_ID, { creditLimit: 300000 }, USER_ID);
    expect(result.creditLimit).toBe(300000);
    expect(prisma.supplierCreditLine.create).toHaveBeenCalledOnce();
  });
});

describe('getCreditLineBalance', () => {
  it('returns correct balance', async () => {
    vi.mocked(prisma.supplierCreditLine.findUnique).mockResolvedValue({
      id: LINE_ID, creditLimit: 300000, isActive: true,
      payments: [{ amount: 100000 }],
    } as any);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 200000 } } as any);

    const bal = await svc.getCreditLineBalance(LINE_ID);
    expect(bal.consumed).toBe(200000);
    expect(bal.paid).toBe(100000);
    expect(bal.pending).toBe(100000);   // consumed - paid
    expect(bal.available).toBe(200000); // limit - pending
  });
});

describe('addPayment', () => {
  it('throws 400 if payment exceeds pending amount', async () => {
    vi.mocked(prisma.supplierCreditLine.findUnique).mockResolvedValue({
      id: LINE_ID, creditLimit: 300000, isActive: true,
      payments: [{ amount: 200000 }],
    } as any);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 200000 } } as any);

    await expect(svc.addPayment(LINE_ID, { amount: 999999, paymentDate: '2026-06-15', paymentMethod: 'TRANSFER' }, USER_ID))
      .rejects.toThrow(AppError);
  });
});
