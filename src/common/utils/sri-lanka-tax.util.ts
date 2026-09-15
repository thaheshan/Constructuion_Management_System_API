/**
 * Sri Lankan Tax Calculation Utility (2026 Compliant)
 * - VAT: 18% Output and Input
 * - EPF: Employee 8%, Employer 12%
 * - ETF: Employer 3%
 * - Progressive Income Tax Bands (Monthly Taxable Base)
 */

export function calculateVAT(amountLKR: number, rate: number = 0.18): { netLKR: number; vatLKR: number; totalLKR: number } {
  const vatLKR = amountLKR * rate;
  return {
    netLKR: amountLKR,
    vatLKR,
    totalLKR: amountLKR + vatLKR,
  };
}

export function calculateEPFETF(grossWagesLKR: number): { epfEmployee8: number; epfEmployer12: number; etfEmployer3: number; totalContributions: number } {
  const epfEmployee8 = grossWagesLKR * 0.08;
  const epfEmployer12 = grossWagesLKR * 0.12;
  const etfEmployer3 = grossWagesLKR * 0.03;
  return {
    epfEmployee8,
    epfEmployer12,
    etfEmployer3,
    totalContributions: epfEmployee8 + epfEmployer12 + etfEmployer3,
  };
}

export function calculateProgressivePAYETax(monthlyIncomeLKR: number): number {
  if (monthlyIncomeLKR <= 100000) return 0;
  
  let tax = 0;
  let remaining = monthlyIncomeLKR - 100000;

  // Band 1: 100k - 200k @ 6%
  if (remaining > 0) {
    const band1 = Math.min(remaining, 100000);
    tax += band1 * 0.06;
    remaining -= band1;
  }
  // Band 2: 200k - 300k @ 12%
  if (remaining > 0) {
    const band2 = Math.min(remaining, 100000);
    tax += band2 * 0.12;
    remaining -= band2;
  }
  // Band 3: 300k - 700k @ 18%
  if (remaining > 0) {
    const band3 = Math.min(remaining, 400000);
    tax += band3 * 0.18;
    remaining -= band3;
  }
  // Band 4: Above 700k @ 24%
  if (remaining > 0) {
    tax += remaining * 0.24;
  }

  return Math.round(tax);
}
