import { describe, it, expect } from 'vitest';
import { validateNCF, isElectronicNCF, extractNCFType, validateRNC } from '../fiscal.utils';

describe('validateNCF', () => {
  it('acepta NCF tradicional válido (letra + 10 dígitos)', () => {
    expect(validateNCF('B0100000001')).toBe(true);
    expect(validateNCF('B0200001234')).toBe(true);
  });

  it('acepta e-NCF válido (E + 12 dígitos)', () => {
    expect(validateNCF('E310000000001')).toBe(true);
    expect(validateNCF('E450000099999')).toBe(true);
  });

  it('rechaza formatos inválidos', () => {
    expect(validateNCF('')).toBe(false);
    expect(validateNCF('B010000001')).toBe(false);    // 10 dígitos (corto)
    expect(validateNCF('B01000000012')).toBe(false);  // 11 dígitos (largo)
    expect(validateNCF('E31000000001')).toBe(false);  // e-NCF de 11 dígitos (corto)
    expect(validateNCF('b0100000001')).toBe(false);   // minúscula
    expect(validateNCF('0100000001B')).toBe(false);   // letra al final
  });
});

describe('isElectronicNCF', () => {
  it('distingue e-NCF de NCF tradicional', () => {
    expect(isElectronicNCF('E310000000001')).toBe(true);
    expect(isElectronicNCF('B0100000001')).toBe(false);
  });

  it('una E con largo de NCF tradicional no es e-NCF', () => {
    expect(isElectronicNCF('E0100000001')).toBe(false);
  });
});

describe('extractNCFType', () => {
  it('extrae tipo de NCF tradicional', () => {
    expect(extractNCFType('B0100000001')).toBe('B01');
    expect(extractNCFType('B1400001234')).toBe('B14');
  });

  it('extrae tipo de e-NCF', () => {
    expect(extractNCFType('E310000000001')).toBe('E31');
    expect(extractNCFType('E450000000001')).toBe('E45');
  });
});

describe('validateRNC', () => {
  it('acepta RNC de 9 dígitos y cédula de 11', () => {
    expect(validateRNC('123456789')).toBe(true);
    expect(validateRNC('12345678901')).toBe(true);
  });

  it('rechaza largos intermedios y no numéricos', () => {
    expect(validateRNC('1234567890')).toBe(false); // 10 dígitos
    expect(validateRNC('12345678')).toBe(false);   // 8 dígitos
    expect(validateRNC('12345678A')).toBe(false);
    expect(validateRNC('')).toBe(false);
  });
});
