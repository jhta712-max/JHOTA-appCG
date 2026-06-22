import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the service
vi.mock('../../config/database', () => ({
  default: {
    aiUsageLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn(),
    };
  },
}));

import prisma from '../../config/database';
import { computeCostUsd, PRICING } from '../ai-usage.service';

describe('ai-usage.service', () => {
  it('computes cost correctly for input tokens', () => {
    // $1.00 per 1M input tokens
    expect(computeCostUsd(1_000_000, 0)).toBeCloseTo(1.0);
    expect(computeCostUsd(500_000, 0)).toBeCloseTo(0.5);
    expect(computeCostUsd(0, 0)).toBe(0);
  });

  it('computes cost correctly for output tokens', () => {
    // $5.00 per 1M output tokens
    expect(computeCostUsd(0, 1_000_000)).toBeCloseTo(5.0);
    expect(computeCostUsd(0, 200_000)).toBeCloseTo(1.0);
  });

  it('computes combined cost', () => {
    // 1M input ($1) + 1M output ($5) = $6
    expect(computeCostUsd(1_000_000, 1_000_000)).toBeCloseTo(6.0);
  });

  it('exposes PRICING constants', () => {
    expect(PRICING.INPUT_PER_MILLION).toBe(1.0);
    expect(PRICING.OUTPUT_PER_MILLION).toBe(5.0);
  });
});
