import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/database', () => ({
  default: {
    aiUsageLog: {
      aggregate: vi.fn(),
      groupBy:   vi.fn(),
      findFirst: vi.fn(),
    },
    aiUsageAlert: {
      findFirst: vi.fn(),
      upsert:    vi.fn(),
    },
  },
}));

import prisma from '../../../config/database';
import { getMonthRange, getMonthlySummary } from '../ai-usage.service';

describe('getMonthRange', () => {
  it('returns start and end of month for 2026-06', () => {
    const { start, end } = getMonthRange('2026-06');
    expect(start).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    expect(end.getMonth()).toBe(5); // June = 5
    expect(end.getDate()).toBe(30);
  });

  it('handles February', () => {
    const { start, end } = getMonthRange('2026-02');
    expect(end.getDate()).toBe(28);
  });
});

describe('getMonthlySummary', () => {
  beforeEach(() => {
    vi.mocked(prisma.aiUsageLog.aggregate).mockResolvedValue({
      _sum: { inputTokens: 100_000, outputTokens: 20_000 },
      _count: { id: 42 },
    } as any);
  });

  it('computes cost from token sums', async () => {
    const result = await getMonthlySummary('2026-06');
    // 100k input @ $1/M = $0.10; 20k output @ $5/M = $0.10; total = $0.20
    expect(result.estimatedCostUsd).toBeCloseTo(0.20);
    expect(result.totalCalls).toBe(42);
    expect(result.totalInputTokens).toBe(100_000);
    expect(result.totalOutputTokens).toBe(20_000);
  });
});
