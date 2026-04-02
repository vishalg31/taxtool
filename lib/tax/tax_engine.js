import { ENABLED_DEDUCTIONS, getEffectiveCap } from "./deductions.config";

const TAX_RULES = {
  fy: "2025-26",
  cessRate: 0.04,
  new: {
    standardDeduction: 75000,
    slabs: [
      { min: 0, max: 400000, rate: 0.0 },
      { min: 400000, max: 800000, rate: 0.05 },
      { min: 800000, max: 1200000, rate: 0.1 },
      { min: 1200000, max: 1600000, rate: 0.15 },
      { min: 1600000, max: 2000000, rate: 0.2 },
      { min: 2000000, max: 2400000, rate: 0.25 },
      { min: 2400000, max: null, rate: 0.3 },
    ],
    rebate87A: { maxTaxableIncome: 1200000, maxRebate: 60000 },
    surcharge: [
      { minIncome: 5000000, maxIncome: 10000000, rate: 0.1 },
      { minIncome: 10000000, maxIncome: 20000000, rate: 0.15 },
      { minIncome: 20000000, maxIncome: null, rate: 0.25 },
    ],
  },
  old: {
    standardDeduction: 50000,
    ageCategorySlabs: {
      below60: [
        { min: 0, max: 250000, rate: 0.0 },
        { min: 250000, max: 500000, rate: 0.05 },
        { min: 500000, max: 1000000, rate: 0.2 },
        { min: 1000000, max: null, rate: 0.3 },
      ],
      senior: [
        { min: 0, max: 300000, rate: 0.0 },
        { min: 300000, max: 500000, rate: 0.05 },
        { min: 500000, max: 1000000, rate: 0.2 },
        { min: 1000000, max: null, rate: 0.3 },
      ],
      superSenior: [
        { min: 0, max: 500000, rate: 0.0 },
        { min: 500000, max: 1000000, rate: 0.2 },
        { min: 1000000, max: null, rate: 0.3 },
      ],
    },
    rebate87A: { maxTaxableIncome: 500000, maxRebate: 12500 },
    surcharge: [
      { minIncome: 5000000, maxIncome: 10000000, rate: 0.1 },
      { minIncome: 10000000, maxIncome: 20000000, rate: 0.15 },
      { minIncome: 20000000, maxIncome: 50000000, rate: 0.25 },
      { minIncome: 50000000, maxIncome: null, rate: 0.37 },
    ],
    hra: {
      metroMultiplier: 0.5,
      nonMetroMultiplier: 0.4,
      metroCities: ["mumbai", "delhi", "kolkata", "chennai"],
      rentThresholdPercent: 0.1,
    },
  },
};

const clampPositive = (n) => Math.max(0, n);
const roundRupee = (n) => Math.round(n);

function calculateHRAExemption({ basicSalary, da = 0, hraReceived, rentPaid, city }) {
  if (!rentPaid || rentPaid <= 0) {
    return { exemption: 0, breakdown: { reason: "No rent paid, so HRA exemption is zero." } };
  }

  if (!hraReceived || hraReceived <= 0) {
    return { exemption: 0, breakdown: { reason: "No HRA received from employer, so exemption is zero." } };
  }

  const basicPlusDA = basicSalary + da;
  const rules = TAX_RULES.old.hra;
  const isMetro = rules.metroCities.includes((city || "").toLowerCase());
  const conditionA = hraReceived;
  const conditionB = clampPositive(rentPaid - rules.rentThresholdPercent * basicPlusDA);
  const conditionC = (isMetro ? rules.metroMultiplier : rules.nonMetroMultiplier) * basicPlusDA;
  const exemption = roundRupee(Math.min(conditionA, conditionB, conditionC));

  return {
    exemption,
    breakdown: {
      isMetro,
      basicPlusDA,
      conditionA_actualHRA: conditionA,
      conditionB_rentMinusThreshold: conditionB,
      conditionC_percentOfBasic: conditionC,
      rentThresholdAmount: rules.rentThresholdPercent * basicPlusDA,
    },
  };
}

function calculateDeductions(deductions = {}, meta = {}) {
  const { isSenior = false, parentsAreSenior = false, regime = "old", basicSalary = 0, da = 0 } = meta;

  const applicableIds = new Set(
    ENABLED_DEDUCTIONS
      .filter((d) => d.regimes.includes(regime))
      .filter((d) => {
        if (d.isSeniorOnly && !isSenior) return false;
        if (d.isSeniorExcluded && isSenior) return false;
        return true;
      })
      .map((d) => d.id)
  );

  let total = 0;
  const breakdown = {};

  if (applicableIds.has("section80C")) {
    const raw = (deductions.section80C || 0) + (deductions.section80CCC || 0) + (deductions.section80CCD1 || 0);
    const value = Math.min(raw, 150000);
    if (value > 0) {
      breakdown["80C / 80CCC / 80CCD(1) group"] = value;
      total += value;
    }
  }

  const singleDeductions = [
    "section80CCD1B",
    "section80CCD2",
    "section80D_self",
    "section80D_parents",
    "homeLoanInterest",
    "section80E",
    "section80EE",
    "section80EEA",
    "section80G",
    "section80GG",
    "section80TTA",
    "section80TTB",
    "section80DD",
    "section80DDB",
    "section80U",
    "professionalTax",
    "childrenEducationAllowance",
  ];

  for (const id of singleDeductions) {
    if (!applicableIds.has(id)) continue;
    const raw = deductions[id] || 0;
    if (!raw) continue;

    const cap = getEffectiveCap(id, {
      isSenior,
      parentsAreSenior,
      basicSalary,
      da,
      employerType: deductions.employerType || "private",
    });
    const value = cap !== null ? Math.min(raw, cap) : clampPositive(raw);
    breakdown[id] = value;
    total += value;
  }

  return { totalDeductions: roundRupee(total), breakdown };
}

function calculateSlabTax(taxableIncome, slabs) {
  if (taxableIncome <= 0) return { tax: 0, slabBreakdown: [] };

  let tax = 0;
  const slabBreakdown = [];

  for (const slab of slabs) {
    if (taxableIncome <= slab.min) break;

    const slabTop = slab.max === null ? taxableIncome : Math.min(slab.max, taxableIncome);
    const taxableInSlab = slabTop - slab.min;
    const taxInSlab = taxableInSlab * slab.rate;

    if (taxableInSlab > 0) {
      slabBreakdown.push({
        range: `Rs ${slab.min.toLocaleString("en-IN")} - ${slab.max ? `Rs ${slab.max.toLocaleString("en-IN")}` : "above"}`,
        rate: `${slab.rate * 100}%`,
        taxableAmount: taxableInSlab,
        tax: roundRupee(taxInSlab),
      });
    }

    tax += taxInSlab;
  }

  return { tax: roundRupee(tax), slabBreakdown };
}

function calculateRebate87A(taxBeforeRebate, taxableIncome, regime) {
  const rule = TAX_RULES[regime].rebate87A;
  if (taxableIncome > rule.maxTaxableIncome) return 0;
  return Math.min(taxBeforeRebate, rule.maxRebate);
}

function calculateSurcharge(taxAfterRebate, totalIncome, regime) {
  const bands = TAX_RULES[regime].surcharge;
  let applicableBand = null;

  for (const band of [...bands].reverse()) {
    if (totalIncome > band.minIncome) {
      applicableBand = band;
      break;
    }
  }

  if (!applicableBand) {
    return { surcharge: 0, surchargeRate: 0, marginalReliefApplied: false };
  }

  let surcharge = roundRupee(taxAfterRebate * applicableBand.rate);
  let marginalReliefApplied = false;
  const incomeAboveThreshold = totalIncome - applicableBand.minIncome;

  if (surcharge > incomeAboveThreshold) {
    surcharge = Math.max(0, incomeAboveThreshold);
    marginalReliefApplied = true;
  }

  return { surcharge, surchargeRate: applicableBand.rate, marginalReliefApplied };
}

function calculateTax(input) {
  const {
    regime,
    grossSalary,
    age = 30,
    hraReceived = 0,
    rentPaid = 0,
    basicSalary = 0,
    da = 0,
    city = "",
    deductions = {},
  } = input;

  if (!["old", "new"].includes(regime)) {
    throw new Error('regime must be "old" or "new"');
  }

  if (typeof grossSalary !== "number" || grossSalary < 0) {
    throw new Error("grossSalary must be a non-negative number");
  }

  const isSenior = age >= 60;
  const parentsAreSenior = deductions.parentsAreSenior || false;
  const result = { regime, fy: TAX_RULES.fy, steps: {} };

  const standardDeduction = TAX_RULES[regime].standardDeduction;
  const afterStandardDeduction = clampPositive(grossSalary - standardDeduction);
  result.steps.step1 = { grossSalary, standardDeduction, afterStandardDeduction };

  let totalExemptions = 0;
  if (regime === "old") {
    const hraResult = calculateHRAExemption({ basicSalary, da, hraReceived, rentPaid, city });
    totalExemptions = hraResult.exemption;
    result.steps.step2 = {
      hraExemption: hraResult.exemption,
      hraBreakdown: hraResult.breakdown,
      totalExemptions,
    };
  } else {
    result.steps.step2 = {
      note: "HRA and exemptions are not available in the new regime.",
      totalExemptions: 0,
    };
  }

  const deductionResult = calculateDeductions(deductions, {
    isSenior,
    parentsAreSenior,
    regime,
    basicSalary,
    da,
  });
  const totalDeductions = deductionResult.totalDeductions;
  result.steps.step3 = { deductionBreakdown: deductionResult.breakdown, totalDeductions };

  const taxableIncome = clampPositive(afterStandardDeduction - totalExemptions - totalDeductions);
  result.steps.step4 = {
    afterStandardDeduction,
    lessExemptions: totalExemptions,
    lessDeductions: totalDeductions,
    taxableIncome,
  };

  let slabs;
  if (regime === "new") {
    slabs = TAX_RULES.new.slabs;
  } else if (age >= 80) {
    slabs = TAX_RULES.old.ageCategorySlabs.superSenior;
  } else if (age >= 60) {
    slabs = TAX_RULES.old.ageCategorySlabs.senior;
  } else {
    slabs = TAX_RULES.old.ageCategorySlabs.below60;
  }

  const { tax: taxBeforeRebate, slabBreakdown } = calculateSlabTax(taxableIncome, slabs);
  result.steps.step5 = { slabBreakdown, taxBeforeRebate };

  const rebate = calculateRebate87A(taxBeforeRebate, taxableIncome, regime);
  const taxAfterRebate = clampPositive(taxBeforeRebate - rebate);
  result.steps.step6 = {
    taxableIncome,
    rebateLimit: TAX_RULES[regime].rebate87A.maxTaxableIncome,
    rebateApplied: rebate,
    taxAfterRebate,
  };

  const { surcharge, surchargeRate, marginalReliefApplied } = calculateSurcharge(taxAfterRebate, taxableIncome, regime);
  const taxAfterSurcharge = taxAfterRebate + surcharge;
  result.steps.step7 = {
    surchargeRate: `${surchargeRate * 100}%`,
    surchargeAmount: surcharge,
    marginalReliefApplied,
    taxAfterSurcharge,
  };

  const cess = roundRupee(taxAfterSurcharge * TAX_RULES.cessRate);
  result.steps.step8 = { cessRate: "4%", cessAmount: cess };

  result.finalTax = taxAfterSurcharge + cess;
  result.summary = {
    grossSalary,
    taxableIncome,
    taxBeforeRebate,
    rebate,
    surcharge,
    cess,
    finalTaxLiability: result.finalTax,
    monthlyTax: Math.floor(result.finalTax / 12),
    effectiveRate: grossSalary > 0 ? `${((result.finalTax / grossSalary) * 100).toFixed(2)}%` : "0%",
    standardDeduction,
    hraExemption: totalExemptions,
    totalDeductions,
    deductionBreakdown: deductionResult.breakdown,
  };

  return result;
}

function calculateTaxEngine(input) {
  const result = calculateTax(input);
  return {
    grossSalary: result.summary.grossSalary,
    taxableIncome: result.summary.taxableIncome,
    taxBeforeRebate: result.summary.taxBeforeRebate,
    rebate: result.summary.rebate,
    surcharge: result.summary.surcharge,
    cess: result.summary.cess,
    finalTax: result.finalTax,
    monthlyTax: result.summary.monthlyTax,
    effectiveRate: result.summary.effectiveRate.replace("%", ""),
    slabBreakdown: result.steps.step5.slabBreakdown,
    standardDeduction: result.summary.standardDeduction,
    hraExemption: result.summary.hraExemption,
    totalDeductions: result.summary.totalDeductions,
    deductionBreakdown: result.summary.deductionBreakdown,
  };
}

function compareRegimes(input) {
  const oldResult = calculateTax({ ...input, regime: "old" });
  const newResult = calculateTax({ ...input, regime: "new" });
  const savings = oldResult.finalTax - newResult.finalTax;

  return {
    old: oldResult,
    new: newResult,
    betterRegime: savings > 0 ? "new" : savings < 0 ? "old" : "same",
    savingsWithBetterRegime: Math.abs(savings),
  };
}

export {
  TAX_RULES,
  calculateHRAExemption,
  calculateDeductions,
  calculateSlabTax,
  calculateRebate87A,
  calculateSurcharge,
  calculateTax,
  calculateTaxEngine,
  compareRegimes,
};
