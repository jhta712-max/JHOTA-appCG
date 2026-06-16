const AFP_RATE = 0.0287;
const TSS_RATE = 0.0304;

// Tramos ISR RD 2024 — ingresos anuales en RD$
const ISR_BRACKETS = [
  { upTo: 416_220,  rate: 0,    base: 0 },
  { upTo: 624_329,  rate: 0.15, base: 0 },
  { upTo: 867_123,  rate: 0.20, base: 31_216.35 },
  { upTo: Infinity, rate: 0.25, base: 79_775.85 },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calculateISR(annualIncome: number): number {
  for (let i = ISR_BRACKETS.length - 1; i >= 0; i--) {
    const prev = i > 0 ? ISR_BRACKETS[i - 1].upTo : 0;
    if (annualIncome > prev) {
      const bracket = ISR_BRACKETS[i];
      return round2(bracket.base + (annualIncome - prev) * bracket.rate);
    }
  }
  return 0;
}

export interface BenefitInput {
  name: string;
  amount: number;
  affectsISR: boolean;
}

export function calculateLine(
  baseSalary: number,
  benefits: BenefitInput[],
  periodType: 'MONTHLY' | 'BIWEEKLY_1' | 'BIWEEKLY_2',
  otherDeductions = 0,
) {
  const divisor = periodType === 'MONTHLY' ? 12 : 24;

  const benefitsTotal = round2(benefits.reduce((s, b) => s + b.amount, 0));
  const taxableBase   = round2(
    baseSalary + benefits.filter((b) => b.affectsISR).reduce((s, b) => s + b.amount, 0),
  );

  const annualTaxable = taxableBase * divisor;
  const annualISR     = calculateISR(annualTaxable);

  const afpEmployee = round2(baseSalary * AFP_RATE);
  const tssEmployee = round2(baseSalary * TSS_RATE);
  const isr         = round2(annualISR / divisor);
  const grossAmount = round2(baseSalary + benefitsTotal);
  const netAmount   = round2(grossAmount - afpEmployee - tssEmployee - isr - otherDeductions);

  return {
    benefitsTotal,
    taxableBase,
    afpEmployee,
    tssEmployee,
    isr,
    grossAmount,
    netAmount,
  };
}
