import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Error de validación Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Datos inválidos',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Error de aplicación conocido
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Error de Prisma: registro duplicado
  if ((err as any).code === 'P2002') {
    res.status(409).json({
      success: false,
      error: 'Ya existe un registro con esos datos',
      code: 'DUPLICATE_RECORD',
    });
    return;
  }

  // Error de Prisma: registro no encontrado
  if ((err as any).code === 'P2025') {
    res.status(404).json({
      success: false,
      error: 'Registro no encontrado',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Error inesperado
  logger.error('Error no manejado', { message: err.message, stack: err.stack, url: req.url });
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
  });
}
