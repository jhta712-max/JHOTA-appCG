import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as svc from './beneficiaries.service';
import { createBeneficiarySchema, updateBeneficiarySchema, ACCOUNT_TYPES } from './beneficiaries.schema';

// ── Normaliza tipoCuenta antes de validar con Zod ─────────────
function normalizeAccountType(raw: unknown): string {
  const v = String(raw ?? '').toLowerCase().trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
  if (v.includes('corriente')) return 'Cuenta Corriente';
  if (v.includes('nomina'))    return 'Cuenta Nómina';
  return 'Cuenta de Ahorros';   // cubre: ahorro, ahorros, cuenta de ahorros, o valor desconocido
}

// ── Normaliza un objeto raw antes de pasarlo al schema ────────
function normalizeRow(raw: unknown): Record<string, unknown> {
  const r = raw as Record<string, unknown>;
  return {
    name:          String(r.name          ?? '').trim(),
    bank:          String(r.bank          ?? '').trim(),
    accountType:   normalizeAccountType(r.accountType),
    accountNumber: String(r.accountNumber ?? '').trim(),
    cedula:        r.cedula ? String(r.cedula).trim() : undefined,
    phone:         r.phone  ? String(r.phone).trim()  : undefined,
  };
}

// ── Controladores ─────────────────────────────────────────────
export async function listBeneficiaries(req: Request, res: Response, next: NextFunction) {
  try {
    const onlyActive = req.query.active !== 'false';
    res.json({ success: true, data: await svc.getBeneficiaries(onlyActive) });
  } catch (err) { next(err); }
}

export async function getBeneficiary(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getBeneficiaryById(req.params.id) });
  } catch (err) { next(err); }
}

export async function createBeneficiary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createBeneficiarySchema.parse(normalizeRow(req.body));
    const b    = await svc.createBeneficiary(data, (req as any).user.userId);
    res.status(201).json({ success: true, data: b });
  } catch (err) { next(err); }
}

export async function updateBeneficiary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateBeneficiarySchema.parse(req.body);
    res.json({ success: true, data: await svc.updateBeneficiary(req.params.id, data) });
  } catch (err) { next(err); }
}

export async function deactivateBeneficiary(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.deactivateBeneficiary(req.params.id) });
  } catch (err) { next(err); }
}

/** Importación masiva — normaliza cada fila y devuelve resultado por fila */
export async function bulkCreateBeneficiaries(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = z.array(z.unknown()).parse(req.body);
    const userId = (req as any).user.userId;

    const results: { index: number; name: string; status: 'ok' | 'error'; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw  = rows[i] as Record<string, unknown>;
      const name = String(raw.name ?? `Fila ${i + 1}`).trim();
      try {
        const normalized = normalizeRow(raw);
        const data       = createBeneficiarySchema.parse(normalized);
        await svc.createBeneficiary(data, userId);
        results.push({ index: i, name, status: 'ok' });
      } catch (e: any) {
        // Extraer mensaje más útil según el tipo de error
        let msg = 'Error desconocido';
        if (e?.issues?.[0]?.message) {
          msg = e.issues[0].message;          // ZodError (v3 usa .issues)
        } else if (e?.errors?.[0]?.message) {
          msg = e.errors[0].message;          // alias de .issues
        } else if (e?.message) {
          msg = e.message;
        }
        results.push({ index: i, name, status: 'error', error: msg });
      }
    }

    const ok  = results.filter((r) => r.status === 'ok').length;
    const err = results.filter((r) => r.status === 'error').length;
    res.json({ success: true, data: { ok, err, results } });
  } catch (err) { next(err); }
}

// Exportar los tipos de cuenta para que el frontend pueda verificar
export { ACCOUNT_TYPES };
