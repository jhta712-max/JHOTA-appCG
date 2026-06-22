import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';

// ── Pricing constants — Haiku 4.5 (update here when model changes) ─────────
export const PRICING = {
  INPUT_PER_MILLION:  1.0,  // USD per 1M input tokens
  OUTPUT_PER_MILLION: 5.0,  // USD per 1M output tokens
} as const;

export type AiFeature =
  | 'OCR'
  | 'WHATSAPP'
  | 'AI_SUMMARY'
  | 'SUGGEST_CATEGORY'
  | 'SUGGEST_CONCEPT'
  | 'MONITORING'
  | 'SUPPLIER_SUGGESTIONS';

export interface TrackAiCallParams {
  feature:    AiFeature;
  request:    MessageCreateParamsNonStreaming;
  client:     Anthropic;
  userId?:    string;
  projectId?: string;
  metadata?:  Record<string, unknown>;
}

/** Compute estimated cost in USD from token counts. */
export function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens  / 1_000_000) * PRICING.INPUT_PER_MILLION +
    (outputTokens / 1_000_000) * PRICING.OUTPUT_PER_MILLION
  );
}

/**
 * Drop-in wrapper for anthropic.messages.create().
 * Calls Claude, persists usage to ai_usage_logs, returns the response.
 * If the DB write fails it logs and continues — never blocks the caller.
 */
export async function trackAiCall(params: TrackAiCallParams): Promise<Anthropic.Message> {
  const { feature, request, client, userId, projectId, metadata } = params;

  const response = await client.messages.create(request);

  // Persist silently — don't let logging errors surface to callers
  setImmediate(async () => {
    try {
      await prisma.aiUsageLog.create({
        data: {
          feature,
          model:        response.model,
          inputTokens:  response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          userId:       userId  ?? null,
          projectId:    projectId ?? null,
          metadata:     metadata !== undefined ? (metadata as unknown as Prisma.InputJsonValue) : undefined,
        },
      });
    } catch (err) {
      logger.error('[AiUsage] Failed to persist usage log:', err);
    }
  });

  return response;
}
