import { describe, it, expect } from 'vitest';
import { buildMessages, extractConfirmation } from '../whatsapp.agent';

describe('buildMessages', () => {
  it('wraps history and current message into Anthropic messages array', () => {
    const history = [
      { role: 'user' as const, content: 'Gasto 3000' },
      { role: 'assistant' as const, content: '¿Para qué proyecto?' },
    ];
    const messages = buildMessages(history, 'Torre Norte');
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('user');
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toBe('Torre Norte');
  });
});

describe('extractConfirmation', () => {
  it('returns null when there is no tool_use block', () => {
    const result = extractConfirmation([
      { type: 'text', text: '¿Para qué proyecto?' },
    ] as any[]);
    expect(result).toBeNull();
  });

  it('extracts confirmation payload from request_confirmation tool_use block', () => {
    const result = extractConfirmation([
      {
        type: 'tool_use',
        name: 'request_confirmation',
        input: {
          intent: 'CREATE_EXPENSE',
          payload: { projectId: 'uuid-1', amount: 2500, categoryId: 3, description: 'Cemento', paymentMethod: 'CASH' },
          summary: 'Gasto de RD$2,500 en cemento — Proyecto Torre Norte',
        },
      },
    ] as any[]);
    expect(result).not.toBeNull();
    expect(result!.intent).toBe('CREATE_EXPENSE');
    expect(result!.payload.amount).toBe(2500);
  });
});
