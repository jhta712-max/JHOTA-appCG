import prisma from '../../config/database';
import Anthropic from '@anthropic-ai/sdk';

export async function listProjectSuppliers(projectId: string) {
  return prisma.projectSupplier.findMany({
    where: { projectId },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          rnc: true,
          isActive: true,
          bank: true,
          accountNumber: true,
          accountType: true,
          bankAccounts: {
            select: {
              id: true,
              bank: true,
              accountType: true,
              accountNumber: true,
              isDefault: true,
            },
          },
        },
      },
    },
    orderBy: { supplier: { name: 'asc' } },
  });
}

export async function assignSupplierToProject(projectId: string, supplierId: string) {
  return prisma.projectSupplier.create({
    data: { projectId, supplierId },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          rnc: true,
          isActive: true,
        },
      },
    },
  });
}

export async function removeSupplierFromProject(projectId: string, supplierId: string) {
  return prisma.projectSupplier.delete({
    where: { projectId_supplierId: { projectId, supplierId } },
  });
}

export async function importFromPayments(projectId: string): Promise<{ imported: number; skipped: number }> {
  const orders = await prisma.paymentOrder.findMany({
    where: {
      projectId,
      status: { not: 'VOIDED' },
    },
    select: { supplierId: true },
    distinct: ['supplierId'],
  });

  let imported = 0;
  let skipped = 0;

  for (const order of orders) {
    try {
      await prisma.projectSupplier.create({
        data: { projectId, supplierId: order.supplierId },
      });
      imported++;
    } catch (e: any) {
      if (e.code === 'P2002') skipped++;
      else throw e;
    }
  }

  return { imported, skipped };
}

export type SupplierSuggestion = {
  supplierId: string;
  name: string;
  rnc: string | null;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
};

export async function getAiSuggestions(projectId: string): Promise<SupplierSuggestion[]> {
  // 1. Already assigned supplier IDs (exclude from suggestions)
  const assigned = await prisma.projectSupplier.findMany({
    where: { projectId },
    select: { supplierId: true },
  });
  const assignedIds = new Set(assigned.map((a) => a.supplierId));

  // 2. Payment orders for this project (for context)
  const orders = await prisma.paymentOrder.findMany({
    where: { projectId, status: { not: 'VOIDED' } },
    select: { concept: true, supplier: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  // 3. All active unassigned suppliers
  const candidates = await prisma.supplier.findMany({
    where: { isActive: true, id: { notIn: [...assignedIds] }, deletedAt: null },
    select: { id: true, name: true, rnc: true },
    orderBy: { name: 'asc' },
  });

  // 4. Cross-project usage counts
  const crossProject = await prisma.projectSupplier.findMany({
    where: { projectId: { not: projectId }, supplierId: { in: candidates.map((c) => c.id) } },
    select: { supplierId: true },
  });
  const crossCount: Record<string, number> = {};
  for (const cp of crossProject) {
    crossCount[cp.supplierId] = (crossCount[cp.supplierId] ?? 0) + 1;
  }

  if (candidates.length === 0) return [];

  const paymentSummary = orders
    .map((o) => `- ${o.supplier?.name ?? 'N/A'}: ${o.concept}`)
    .join('\n') || 'Sin pagos registrados aún';

  const candidateList = candidates
    .map((c) => `${c.id}|${c.name}${c.rnc ? `|RNC:${c.rnc}` : ''}|proyectos:${crossCount[c.id] ?? 0}`)
    .join('\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Eres un asistente de una empresa constructora dominicana. Analiza los pagos del proyecto y sugiere cuáles suplidores candidatos deberían ser asignados.

PAGOS RECIENTES DEL PROYECTO:
${paymentSummary}

SUPLIDORES CANDIDATOS (id|nombre|proyectos_en_otros_proyectos):
${candidateList}

Devuelve SOLO un JSON válido, sin texto adicional:
[{"supplierId":"uuid","reason":"razón breve en español","confidence":"HIGH|MEDIUM|LOW"}]

Reglas: máximo 8 sugerencias, solo relevantes, [] si no hay contexto suficiente.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
  let raw: Array<{ supplierId: string; reason: string; confidence: string }> = [];
  try { raw = JSON.parse(text); } catch { return []; }

  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  return raw
    .filter((r) => candidateMap.has(r.supplierId))
    .map((r) => {
      const c = candidateMap.get(r.supplierId)!;
      return { supplierId: c.id, name: c.name, rnc: c.rnc, reason: r.reason, confidence: r.confidence as 'HIGH' | 'MEDIUM' | 'LOW' };
    });
}
