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
    logger.debug(`Validation error on ${req.method} ${req.path}`, { errors: err.flatten().fieldErrors });
    res.status(400).json({
      success: false,
      error: 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Error de aplicación conocido
  if (err instanceof AppError) {
    logger.debug(`AppError on ${req.method} ${req.path}: ${err.code || 'UNKNOWN'}`, { message: err.message });
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Error de Prisma: registro duplicado
  if ((err as any).code === 'P2002') {
    logger.warn(`Duplicate record on ${req.method} ${req.path}`, { error: (err as any).message });
    res.status(409).json({
      success: false,
      error: 'Ya existe un registro con esos datos',
      code: 'DUPLICATE_RECORD',
    });
    return;
  }

  // Error de Prisma: registro no encontrado
  if ((err as any).code === 'P2025') {
    logger.debug(`Record not found on ${req.method} ${req.path}`);
    res.status(404).json({
      success: false,
      error: 'Registro no encontrado',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Error inesperado
  logger.error('Unhandled error', { message: err.message, stack: err.stack, url: req.url });
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
  });
}

