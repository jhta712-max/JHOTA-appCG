import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type Target = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: Target = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      // Log para debugging
      console.log(`[VALIDATE] Error en ${target}:`, JSON.stringify(result.error.flatten(), null, 2));
      next(result.error);
      return;
    }
    req[target] = result.data;
    next();
  };
}
