import prisma from '../../config/database';
import { computeCostUsd } from '../../services/ai-usage.service';

export interface MonthlySummary {
  month:              string;
  totalInputTokens:   number;
  totalOutputTokens:  number;
  totalCostUsd:       number;
  totalCalls:         number;
}

export interface FeatureBreakdown {
  feature:     string;
  calls:       number;
  inputTokens: number;
  outputTokens: number;
  costUsd:     number;
  pct:         number;
}

export interface UserBreakdown {
  userId:       string | null;
  userName:     string;
  userRole:     string | null;
  calls:        number;
  inputTokens:  number;
  outputTokens: number;
  costUsd:      number;
}

export interface AlertConfig {
  id:              string;
  monthlyLimitUsd: number;
  enabled:         boolean;
}

/** Returns UTC start/end Date objects for a YYYY-MM string. */
export function getMonthRange(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999)); // last day
  return { start, end };
}

export async function getMonthlySummary(month: string): Promise<MonthlySummary> {
  const { start, end } = getMonthRange(month);

  const agg = await prisma.aiUsageLog.aggregate({
    where:    { createdAt: { gte: start, lte: end } },
    _sum:     { inputTokens: true, outputTokens: true },
    _count:   { id: true },
  });

  const inputTokens  = agg._sum.inputTokens  ?? 0;
  const outputTokens = agg._sum.outputTokens ?? 0;

  return {
    month,
    totalInputTokens:  inputTokens,
    totalOutputTokens: outputTokens,
    totalCostUsd:      computeCostUsd(inputTokens, outputTokens),
    totalCalls:        agg._count.id ?? 0,
  };
}

export async function getByFeature(month: string): Promise<FeatureBreakdown[]> {
  const { start, end } = getMonthRange(month);

  const rows = await prisma.aiUsageLog.groupBy({
    by:    ['feature'],
    where: { createdAt: { gte: start, lte: end } },
    _sum:  { inputTokens: true, outputTokens: true },
    _count: { id: true },
  });

  const totalCost = rows.reduce(
    (s, r) => s + computeCostUsd(r._sum.inputTokens ?? 0, r._sum.outputTokens ?? 0),
    0,
  );

  return rows.map((r) => {
    const cost = computeCostUsd(r._sum.inputTokens ?? 0, r._sum.outputTokens ?? 0);
    return {
      feature:     r.feature,
      calls:       r._count.id,
      inputTokens: r._sum.inputTokens  ?? 0,
      outputTokens: r._sum.outputTokens ?? 0,
      costUsd:     cost,
      pct:         totalCost > 0 ? (cost / totalCost) * 100 : 0,
    };
  }).sort((a, b) => b.costUsd - a.costUsd);
}

export async function getByUser(month: string): Promise<UserBreakdown[]> {
  const { start, end } = getMonthRange(month);

  const rows = await prisma.aiUsageLog.groupBy({
    by:    ['userId'],
    where: { createdAt: { gte: start, lte: end } },
    _sum:  { inputTokens: true, outputTokens: true },
    _count: { id: true },
  });

  // Fetch user details for non-null userIds
  const userIds = rows.map((r) => r.userId).filter((id): id is string => id !== null);
  const users   = userIds.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true, role: { select: { name: true } } },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const user = r.userId ? userMap.get(r.userId) : null;
    const input  = r._sum.inputTokens  ?? 0;
    const output = r._sum.outputTokens ?? 0;
    return {
      userId:       r.userId,
      userName:     user?.name ?? 'Sistema (cron)',
      userRole:     user?.role?.name ?? null,
      calls:        r._count.id,
      inputTokens:  input,
      outputTokens: output,
      costUsd:      computeCostUsd(input, output),
    };
  }).sort((a, b) => b.costUsd - a.costUsd);
}

export async function getAlert(): Promise<AlertConfig | null> {
  const row = await prisma.aiUsageAlert.findFirst();
  if (!row) return null;
  return {
    id:              row.id,
    monthlyLimitUsd: Number(row.monthlyLimitUsd),
    enabled:         row.enabled,
  };
}

export async function upsertAlert(monthlyLimitUsd: number, enabled = true): Promise<AlertConfig> {
  const existing = await prisma.aiUsageAlert.findFirst();
  const row = existing
    ? await prisma.aiUsageAlert.update({
        where: { id: existing.id },
        data:  { monthlyLimitUsd, enabled },
      })
    : await prisma.aiUsageAlert.create({
        data: { monthlyLimitUsd, enabled },
      });
  return {
    id:              row.id,
    monthlyLimitUsd: Number(row.monthlyLimitUsd),
    enabled:         row.enabled,
  };
}
