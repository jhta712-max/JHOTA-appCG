import { env } from '../config/env';

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[env.LOG_LEVEL] ?? levels.info;

function format(level: string, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${ts}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}`;
}

export const logger = {
  error: (msg: string, meta?: unknown) => {
    if (currentLevel >= levels.error) console.error(format('error', msg, meta));
  },
  warn: (msg: string, meta?: unknown) => {
    if (currentLevel >= levels.warn) console.warn(format('warn', msg, meta));
  },
  info: (msg: string, meta?: unknown) => {
    if (currentLevel >= levels.info) console.log(format('info', msg, meta));
  },
  debug: (msg: string, meta?: unknown) => {
    if (currentLevel >= levels.debug) console.log(format('debug', msg, meta));
  },
};
