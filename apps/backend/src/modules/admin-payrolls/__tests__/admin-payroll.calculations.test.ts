import { describe, it, expect } from 'vitest';
import { calculateLine } from '../admin-payroll.calculations';

describe('calculateLine', () => {
  it('calcula AFP y TSS sobre salario base solamente', () => {
    const result = calculateLine(
      50_000,
      [{ name: 'Vehículo', amount: 10_000, affectsISR: false }],
      'MONTHLY',
    );
    expect(result.afpEmployee).toBe(1435);   // 50000 * 0.0287
    expect(result.tssEmployee).toBe(1520);   // 50000 * 0.0304
    expect(result.benefitsTotal).toBe(10_000);
    expect(result.grossAmount).toBe(60_000);
  });

  it('taxableBase incluye solo beneficios con affectsISR=true', () => {
    const result = calculateLine(
      50_000,
      [
        { name: 'Vehículo',  amount: 5_000, affectsISR: false },
        { name: 'Comisión',  amount: 3_000, affectsISR: true  },
      ],
      'MONTHLY',
    );
    expect(result.taxableBase).toBe(53_000); // 50000 + 3000
    expect(result.benefitsTotal).toBe(8_000);
  });

  it('salario bajo el mínimo exento tiene ISR = 0', () => {
    // 30000/mes * 12 = 360000/año < 416220 → ISR 0
    const result = calculateLine(30_000, [], 'MONTHLY');
    expect(result.isr).toBe(0);
  });

  it('salario en segundo tramo tiene ISR correcto', () => {
    // 40000/mes * 12 = 480000/año
    // Tramo: 480000 - 416220 = 63780 * 0.15 = 9567/año → 797.25/mes
    const result = calculateLine(40_000, [], 'MONTHLY');
    expect(result.isr).toBe(797.25);
  });

  it('quincena divide ISR anual entre 24', () => {
    const monthly = calculateLine(40_000, [], 'MONTHLY');
    const biweekly = calculateLine(20_000, [], 'BIWEEKLY_1');
    // Ingreso anual quincena: 20000 * 24 = 480000 → mismo tramo
    expect(biweekly.isr).toBeCloseTo(monthly.isr / 2, 1);
  });

  it('netAmount = gross - afp - tss - isr - otherDeductions', () => {
    const result = calculateLine(50_000, [], 'MONTHLY', 500);
    const expected = result.grossAmount - result.afpEmployee - result.tssEmployee - result.isr - 500;
    expect(result.netAmount).toBeCloseTo(expected, 2);
  });
});
