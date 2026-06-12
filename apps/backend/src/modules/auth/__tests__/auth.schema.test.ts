import { describe, it, expect } from 'vitest';
import { loginSchema, refreshSchema } from '../auth.schema';

describe('loginSchema', () => {
  it('acepta credenciales válidas y normaliza el email a minúsculas', () => {
    const r = loginSchema.safeParse({ email: 'Admin@Empresa.COM', password: 'secreto123' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('admin@empresa.com');
  });

  it('rechaza email con formato inválido', () => {
    expect(loginSchema.safeParse({ email: 'no-es-email', password: 'secreto123' }).success).toBe(false);
  });

  it('rechaza contraseña menor a 6 caracteres', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '12345' }).success).toBe(false);
  });

  it('rechaza campos faltantes', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('exige refreshToken', () => {
    expect(refreshSchema.safeParse({}).success).toBe(false);
    expect(refreshSchema.safeParse({ refreshToken: 'abc' }).success).toBe(true);
  });
});
