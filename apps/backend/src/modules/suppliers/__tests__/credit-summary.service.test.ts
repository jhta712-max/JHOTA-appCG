import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/database', () => ({
  default: {
    supplierCreditLine: { findMany: vi.fn() },
    expense: { aggregate: vi.fn() },
  },
}));

import prisma from '../../../config/database';
import { getCreditSummary } from '../credit-summary.service';

beforeEach(() => vi.clearAllMocks());

describe('getCreditSummary', () => {
  it('returns aggregate totals and line list', async () => {
    vi.mocked(prisma.supplierCreditLine.findMany).mockResolvedValue([
      {
        id: 'line-1',
        supplierId: 's-1',
        creditLimit: 500000,
        isActive: true,
        updatedAt: new Date('2026-06-01'),
        payments: [{ amount: 100000 }],
        supplier: { id: 's-1', name: 'Ferretería ABC', rnc: '101234567' },
      } as any,
    ]);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 300000 } } as any);

    const result = await getCreditSummary();

    expect(result.activeLines).toBe(1);
    expect(result.totalLimit).toBe(500000);
    expect(result.totalPending).toBe(200000);
    expect(result.totalAvailable).toBe(300000);
    expect(result.lines[0].supplierName).toBe('Ferretería ABC');
    expect(result.lines[0].pending).toBe(200000);
  });

  it('handles supplier with no expenses (consumed=0)', async () => {
    vi.mocked(prisma.supplierCreditLine.findMany).mockResolvedValue([
      {
        id: 'line-2',
        supplierId: 's-2',
        creditLimit: 200000,
        isActive: true,
        updatedAt: new Date(),
        payments: [],
        supplier: { id: 's-2', name: 'Materiales XYZ', rnc: null },
      } as any,
    ]);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: null } } as any);

    const result = await getCreditSummary();
    expect(result.totalPending).toBe(0);
    expect(result.totalAvailable).toBe(200000);
  });
});
