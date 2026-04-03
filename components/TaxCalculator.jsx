"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import {
  ADVANCED_DEDUCTIONS,
  BASIC_DEDUCTIONS,
  ENABLED_DEDUCTIONS,
  NEW_REGIME_DEDUCTIONS,
  getEffectiveCap,
} from "@/lib/tax/deductions.config";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TAX ENGINE (inlined for self-contained artifact)
// In your Next.js project, replace calculateTaxEngine calls with API fetches
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    slabs: [
      { min: 0, max: 250000, rate: 0.0 },
      { min: 250000, max: 500000, rate: 0.05 },
      { min: 500000, max: 1000000, rate: 0.2 },
      { min: 1000000, max: null, rate: 0.3 },
    ],
    seniorSlabs: [
      { min: 0, max: 300000, rate: 0.0 },
      { min: 300000, max: 500000, rate: 0.05 },
      { min: 500000, max: 1000000, rate: 0.2 },
      { min: 1000000, max: null, rate: 0.3 },
    ],
    superSeniorSlabs: [
      { min: 0, max: 500000, rate: 0.0 },
      { min: 500000, max: 1000000, rate: 0.2 },
      { min: 1000000, max: null, rate: 0.3 },
    ],
    rebate87A: { maxTaxableIncome: 500000, maxRebate: 12500 },
    surcharge: [
      { minIncome: 5000000, maxIncome: 10000000, rate: 0.1 },
      { minIncome: 10000000, maxIncome: 20000000, rate: 0.15 },
      { minIncome: 20000000, maxIncome: 50000000, rate: 0.25 },
      { minIncome: 50000000, maxIncome: null, rate: 0.37 },
    ],
  },
};

function clampPositive(n) { return Math.max(0, n); }
function roundRupee(n) { return Math.round(n); }

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
        range: `₹${fmt(slab.min)} - ${slab.max ? "₹" + fmt(slab.max) : "above"}`,
        rate: `${slab.rate * 100}%`,
        taxableAmount: taxableInSlab,
        tax: roundRupee(taxInSlab),
      });
    }
    tax += taxInSlab;
  }
  return { tax: roundRupee(tax), slabBreakdown };
}

function calculateHRA({ basicSalary, da = 0, hraReceived, rentPaid, city }) {
  if (!rentPaid || rentPaid <= 0 || !hraReceived || hraReceived <= 0) return 0;
  const basicPlusDA = basicSalary + da;
  const metroCities = ["mumbai", "delhi", "kolkata", "chennai"];
  const isMetro = metroCities.includes((city || "").toLowerCase());
  const condA = hraReceived;
  const condB = clampPositive(rentPaid - 0.1 * basicPlusDA);
  const condC = (isMetro ? 0.5 : 0.4) * basicPlusDA;
  return roundRupee(Math.min(condA, condB, condC));
}

function calculateTaxEngine(input) {
  const { regime, grossSalary, age = 30, basicSalary = 0, da = 0,
    hraReceived = 0, rentPaid = 0, city = "", deductions = {} } = input;
  const stdDed = TAX_RULES[regime].standardDeduction;
  const afterStd = clampPositive(grossSalary - stdDed);
  let exemptions = 0;
  if (regime === "old") exemptions = calculateHRA({ basicSalary, da, hraReceived, rentPaid, city });
  const isSenior = age >= 60;
  const parentsAreSenior = deductions.parentsAreSenior || false;
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
  let totalDed = 0;
  const deductionBreakdown = {};
  if (applicableIds.has("section80C")) {
    const grouped80C = Math.min(
      (deductions.section80C || 0) + (deductions.section80CCC || 0) + (deductions.section80CCD1 || 0),
      150000
    );
    if (grouped80C > 0) {
      totalDed += grouped80C;
      deductionBreakdown["80C / 80CCC / 80CCD(1)"] = grouped80C;
    }
  }
  [
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
  ].forEach((id) => {
    if (!applicableIds.has(id)) return;
    const raw = deductions[id] || 0;
    if (!raw) return;
    const cap = getEffectiveCap(id, {
      isSenior,
      parentsAreSenior,
      basicSalary,
      da,
      employerType: deductions.employerType || "private",
    });
    const value = cap === null ? clampPositive(raw) : Math.min(raw, cap);
    totalDed += value;
    const config = ENABLED_DEDUCTIONS.find((d) => d.id === id);
    deductionBreakdown[config?.section || id] = value;
  });
  const taxableIncome = clampPositive(afterStd - exemptions - totalDed);
  let slabs = TAX_RULES[regime].slabs;
  if (regime === "old") {
    if (age >= 80) slabs = TAX_RULES.old.superSeniorSlabs;
    else if (age >= 60) slabs = TAX_RULES.old.seniorSlabs;
  }
  const { tax: taxBeforeRebate, slabBreakdown } = calculateSlabTax(taxableIncome, slabs);
  const rebateRule = TAX_RULES[regime].rebate87A;
  const rebate = taxableIncome <= rebateRule.maxTaxableIncome ? Math.min(taxBeforeRebate, rebateRule.maxRebate) : 0;
  const taxAfterRebate = clampPositive(taxBeforeRebate - rebate);
  let surcharge = 0;
  for (const band of [...TAX_RULES[regime].surcharge].reverse()) {
    if (taxableIncome > band.minIncome) {
      surcharge = roundRupee(taxAfterRebate * band.rate);
      const relief = taxableIncome - band.minIncome;
      if (surcharge > relief) surcharge = Math.max(0, relief);
      break;
    }
  }
  const taxWithSurcharge = taxAfterRebate + surcharge;
  const cess = roundRupee(taxWithSurcharge * TAX_RULES.cessRate);
  const finalTax = taxWithSurcharge + cess;
  return {
    grossSalary, taxableIncome, taxBeforeRebate, rebate, surcharge, cess, finalTax,
    monthlyTax: Math.floor(finalTax / 12),
    effectiveRate: grossSalary > 0 ? (finalTax / grossSalary * 100).toFixed(2) : "0.00",
    slabBreakdown, standardDeduction: stdDed, hraExemption: exemptions, totalDeductions: totalDed, deductionBreakdown,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmt(n) {
  if (n === null || n === undefined) return "0";
  return Number(n).toLocaleString("en-IN");
}

function fmtCurrency(n) {
  if (!n) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

function getSurchargeMeta(result, regime) {
  const taxableIncome = Number(result?.taxableIncome || 0);
  const bands = regime === "new"
    ? [
        { threshold: 5000000, rate: 10 },
        { threshold: 10000000, rate: 15 },
        { threshold: 20000000, rate: 25 },
      ]
    : [
        { threshold: 5000000, rate: 10 },
        { threshold: 10000000, rate: 15 },
        { threshold: 20000000, rate: 25 },
        { threshold: 50000000, rate: 37 },
      ];

  let matched = null;
  for (const band of bands) {
    if (taxableIncome > band.threshold) matched = band;
  }

  if (!matched) {
    return {
      rate: 0,
      info: "Not applicable because taxable income is at or below ₹50 lakh. Surcharge is checked on taxable income, not gross salary.",
    };
  }

  return {
    rate: matched.rate,
    info: `Applied at ${matched.rate}% because taxable income exceeds ₹${fmt(matched.threshold)}. Marginal relief is also considered near threshold crossings.`,
  };
}

function getDeductionRows(result, regime) {
  if (!result?.deductionBreakdown) return [];

  return Object.entries(result.deductionBreakdown).map(([label, value]) => {
    if (label === "80C / 80CCC / 80CCD(1)") {
      return ["80C / 80CCC / 80CCD(1)", -value];
    }

    if (regime === "new" && label === "80CCD(2)") {
      return ["80CCD(2) - Employer NPS", -value];
    }

    return [`${label} Deduction`, -value];
  });
}

function sanitizeDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

// â”€â”€ Number â†’ Indian words (live, as-you-type) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function numberToWords(n) {
  if (!n || isNaN(n) || Number(n) === 0) return "";
  const num = Math.abs(Math.round(Number(n)));

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }
  function threeDigits(n) {
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + twoDigits(n % 100) : "");
  }

  if (num >= 10000000) {
    const cr = Math.floor(num / 10000000);
    const rem = num % 10000000;
    return threeDigits(cr) + " Crore" + (rem > 0 ? " " + numberToWords(rem) : "");
  }
  if (num >= 100000) {
    const lac = Math.floor(num / 100000);
    const rem = num % 100000;
    return twoDigits(lac) + " Lakh" + (rem > 0 ? " " + numberToWords(rem) : "");
  }
  if (num >= 1000) {
    const th = Math.floor(num / 1000);
    const rem = num % 1000;
    return twoDigits(th) + " Thousand" + (rem > 0 ? " " + threeDigits(rem) : "");
  }
  return threeDigits(num);
}

function getSavingsTips(oldResult, newResult, inputs) {
  const tips = [];
  const ded = inputs.deductions || {};
  if (oldResult.finalTax < newResult.finalTax) {
    tips.push({ type: "regime", icon: "🏆", label: "Old Regime saves you more", detail: `You save ${fmtCurrency(newResult.finalTax - oldResult.finalTax)} by staying in the Old Regime.` });
  } else if (newResult.finalTax < oldResult.finalTax) {
    tips.push({ type: "regime", icon: "🏆", label: "New Regime saves you more", detail: `You save ${fmtCurrency(oldResult.finalTax - newResult.finalTax)} with the New Regime - simpler, no paperwork needed.` });
  } else {
    tips.push({ type: "regime", icon: "🏆", label: "Both regimes are equally good", detail: "Your final tax is the same in both regimes based on the current inputs." });
  }
  const current80C = ded.section80C || 0;
  if (current80C < 150000) {
    const gap = 150000 - current80C;
    tips.push({ type: "invest", icon: "💰", label: `Invest ₹${fmt(gap)} more under 80C (Only for Old Regime)`, detail: `Max out PPF, ELSS or EPF. Save up to ₹${fmt(Math.round(gap * 0.3))} in taxes.` });
  }
  if (!(ded.section80D_self) || ded.section80D_self === 0) {
    tips.push({ type: "invest", icon: "🏥", label: "Claim health insurance (80D) (Only for Old Regime)", detail: "A family floater plan gives ₹25,000 deduction. Add parents for another ₹25,000-₹50,000." });
  }
  if (!(ded.section80CCD1B) || ded.section80CCD1B < 50000) {
    const gap = 50000 - (ded.section80CCD1B || 0);
    tips.push({ type: "invest", icon: "📈", label: `Invest ₹${fmt(gap)} more in NPS (80CCD-1B) (Only for Old Regime)`, detail: `Extra ₹50,000 deduction OVER the 80C limit. Tax saving: up to ₹${fmt(Math.round(gap * 0.3))}.` });
  }
  if (!inputs.hraReceived) {
    tips.push({ type: "info", icon: "🏠", label: "Paying rent? Claim HRA (Only for Old Regime)", detail: "Enter HRA details to get a significant tax exemption under Section 10(13A)." });
  }
  if (!ded.homeLoanInterest) {
    tips.push({ type: "info", icon: "🏡", label: "Home loan interest deduction (Only for Old Regime)", detail: "Claim up to ₹2,00,000 interest deduction under Section 24(b)." });
  }
  return tips;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DOWNLOAD: PDF (print-ready HTML with Calibri font)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function downloadPDF(oldResult, newResult, inputs) {
  const better = oldResult.finalTax <= newResult.finalTax ? "old" : "new";
  const saving = Math.abs(oldResult.finalTax - newResult.finalTax);
  const tips = getSavingsTips(oldResult, newResult, inputs);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Tax Finder Report FY 2025-26</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Calibri, 'Gill Sans MT', 'Trebuchet MS', sans-serif;
    color: #1a1a1a; background: #fff; padding: 40px 48px;
    max-width: 780px; margin: auto; font-size: 13px; line-height: 1.6;
  }
  .header { border-bottom: 3px solid #0f4c75; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .logo { font-size: 22px; font-weight: 700; color: #0f4c75; letter-spacing: -0.5px; }
  .logo span { color: #f59e0b; }
  .meta { font-size: 11px; color: #888; text-align: right; }
  h2 { font-size: 15px; font-weight: 700; color: #0f4c75; margin-bottom: 12px; }
  .winner-box { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 10px; padding: 18px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .winner-label { font-size: 11px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .winner-name { font-size: 20px; font-weight: 700; color: #0f4c75; }
  .saving-amt .amt { font-size: 24px; font-weight: 700; color: #16a34a; }
  .saving-amt .lbl { font-size: 11px; color: #888; text-align: right; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .card.winner { border-color: #0f4c75; background: #f0f7ff; }
  .card-title { font-size: 13px; font-weight: 700; color: #0f4c75; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #f0f0f0; font-size: 12.5px; }
  .row.total { border-bottom: none; font-weight: 700; font-size: 13px; color: #0f4c75; padding-top: 8px; border-top: 2px solid #e2e8f0; }
  .deduct { color: #16a34a; }
  .compare table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 24px; }
  .compare th { background: #0f4c75; color: #fff; padding: 8px 12px; text-align: left; font-weight: 600; }
  .compare th:not(:first-child) { text-align: right; }
  .compare td { padding: 7px 12px; border-bottom: 1px solid #f0f0f0; }
  .compare td:not(:first-child) { text-align: right; font-family: 'Courier New', monospace; }
  .compare tr:nth-child(even) { background: #f8fafc; }
  .best { color: #16a34a; font-weight: 700; }
  .tip { display: flex; gap: 10px; margin-bottom: 10px; padding: 10px 14px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #f59e0b; }
  .tip strong { display: block; font-size: 12.5px; }
  .tip span { font-size: 11.5px; color: #555; }
  .footer { font-size: 10.5px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; margin-top: 16px; display: flex; justify-content: space-between; }
  .print-btn { text-align: center; margin: 24px 0 8px; }
  .print-btn button { background: #0f4c75; color: #fff; border: none; padding: 10px 28px; border-radius: 6px; font-family: Calibri, sans-serif; font-size: 14px; cursor: pointer; font-weight: 600; }
  .print-hint { font-size: 11px; color: #aaa; margin-top: 8px; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Tax<span>Finder</span></div>
    <div style="font-size:12px;color:#555;margin-top:2px">Income Tax Calculator - FY 2025-26 (AY 2026-27)</div>
  </div>
  <div class="meta">
    Gross Salary: <strong>${fmtCurrency(inputs.grossSalary)}</strong><br/>
    (${numberToWords(inputs.grossSalary)} Rupees)<br/>
    Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}<br/>
    Salaried Individual
  </div>
</div>

<div class="winner-box">
  <div>
    <div class="winner-label">Recommended Regime</div>
    <div class="winner-name">${better === "new" ? "New Tax Regime" : "Old Tax Regime"}</div>
    <div style="font-size:12px;color:#555;margin-top:4px">Lower tax liability for your income and investment profile</div>
  </div>
  <div class="saving-amt">
    <div class="amt">${fmtCurrency(saving)}</div>
    <div class="lbl">Annual savings<br/>vs other regime</div>
  </div>
</div>

<div class="grid">
  <div class="card ${better === "new" ? "winner" : ""}">
    <div class="card-title">New Regime ${better === "new" ? "✓ Recommended" : ""}</div>
    <div class="row"><span>Gross Salary</span><span>${fmtCurrency(newResult.grossSalary)}</span></div>
    <div class="row"><span>Standard Deduction</span><span class="deduct">-${fmtCurrency(newResult.standardDeduction)}</span></div>
    <div class="row"><span>Taxable Income</span><span>${fmtCurrency(newResult.taxableIncome)}</span></div>
    <div class="row"><span>Tax on Slabs</span><span>${fmtCurrency(newResult.taxBeforeRebate)}</span></div>
    <div class="row"><span>Rebate u/s 87A</span><span class="deduct">-${fmtCurrency(newResult.rebate)}</span></div>
    <div class="row"><span>Surcharge</span><span>${fmtCurrency(newResult.surcharge)}</span></div>
    <div class="row"><span>Cess @ 4%</span><span>${fmtCurrency(newResult.cess)}</span></div>
    <div class="row total"><span>Final Tax Liability</span><span>${fmtCurrency(newResult.finalTax)}</span></div>
  </div>
  <div class="card ${better === "old" ? "winner" : ""}">
    <div class="card-title">Old Regime ${better === "old" ? "✓ Recommended" : ""}</div>
    <div class="row"><span>Gross Salary</span><span>${fmtCurrency(oldResult.grossSalary)}</span></div>
    <div class="row"><span>Standard Deduction</span><span class="deduct">-${fmtCurrency(oldResult.standardDeduction)}</span></div>
    ${oldResult.hraExemption > 0 ? `<div class="row"><span>HRA Exemption</span><span class="deduct">-${fmtCurrency(oldResult.hraExemption)}</span></div>` : ""}
    ${oldResult.totalDeductions > 0 ? `<div class="row"><span>Other Deductions</span><span class="deduct">-${fmtCurrency(oldResult.totalDeductions)}</span></div>` : ""}
    <div class="row"><span>Taxable Income</span><span>${fmtCurrency(oldResult.taxableIncome)}</span></div>
    <div class="row"><span>Tax on Slabs</span><span>${fmtCurrency(oldResult.taxBeforeRebate)}</span></div>
    <div class="row"><span>Rebate u/s 87A</span><span class="deduct">-${fmtCurrency(oldResult.rebate)}</span></div>
    <div class="row"><span>Surcharge</span><span>${fmtCurrency(oldResult.surcharge)}</span></div>
    <div class="row"><span>Cess @ 4%</span><span>${fmtCurrency(oldResult.cess)}</span></div>
    <div class="row total"><span>Final Tax Liability</span><span>${fmtCurrency(oldResult.finalTax)}</span></div>
  </div>
</div>

<div class="compare">
  <h2>Side-by-Side Comparison</h2>
  <table>
    <tr><th>Particulars</th><th>New Regime</th><th>Old Regime</th></tr>
    ${[
      ["Gross Salary", newResult.grossSalary, oldResult.grossSalary],
      ["Standard Deduction", newResult.standardDeduction, oldResult.standardDeduction],
      ["Taxable Income", newResult.taxableIncome, oldResult.taxableIncome],
      ["Tax on Slabs", newResult.taxBeforeRebate, oldResult.taxBeforeRebate],
      ["Rebate u/s 87A", newResult.rebate, oldResult.rebate],
      ["Surcharge", newResult.surcharge, oldResult.surcharge],
      ["Cess @ 4%", newResult.cess, oldResult.cess],
      ["Final Tax Liability", newResult.finalTax, oldResult.finalTax],
      ["Monthly TDS", newResult.monthlyTax, oldResult.monthlyTax],
    ].map(([label, nv, ov]) =>
      `<tr><td>${label}</td><td class="${nv <= ov ? "best" : ""}">${fmtCurrency(nv)}</td><td class="${ov < nv ? "best" : ""}">${fmtCurrency(ov)}</td></tr>`
    ).join("")}
  </table>
</div>

<h2>Tax Saving Recommendations</h2>
${tips.map(t => `<div class="tip"><span style="font-size:16px">${t.icon}</span><div><strong>${t.label}</strong><span>${t.detail}</span></div></div>`).join("")}

<div class="print-btn">
  <button onclick="window.print()">Print / Save as PDF</button>
  <p class="print-hint">Use browser Print -> Save as PDF for best results</p>
</div>

<div class="footer">
  <span>Tax Finder - Income Tax Calculator · FY 2025-26 · Free, no signup</span>
  <span>Informational only. Consult a CA for professional tax advice.</span>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "TaxClarity-Report-FY2025-26.html";
  a.click();
  URL.revokeObjectURL(url);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DOWNLOAD: CSV
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function downloadRealPDF(oldResult, newResult, inputs) {
  const better = oldResult.finalTax <= newResult.finalTax ? "old" : "new";
  const saving = Math.abs(oldResult.finalTax - newResult.finalTax);
  const tips = getSavingsTips(oldResult, newResult, inputs);
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (space = 24) => {
    if (y + space <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const drawText = (text, x, options = {}) => {
    const { size = 11, color = [31, 41, 55], bold = false, align = "left" } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(text), x, y, { align });
  };

  const drawWrapped = (text, x, width, options = {}) => {
    const { size = 10.5, color = [71, 85, 105], lineGap = 14 } = options;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), width);
    lines.forEach((line) => {
      ensureSpace(lineGap);
      doc.text(line, x, y);
      y += lineGap;
    });
  };

  const addSection = (title) => {
    ensureSpace(34);
    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
    drawText(title, margin, { size: 13, color: [15, 76, 117], bold: true });
    y += 14;
  };

  const drawTable = (headers, rows, columnWidths, options = {}) => {
    const headerHeight = options.headerHeight || 22;
    const rowHeight = options.rowHeight || 20;
    const rightAlignFrom = options.rightAlignFrom ?? 1;
    const emphasizeRows = options.emphasizeRows || new Set();
    const startX = margin;

    const drawHeader = () => {
      ensureSpace(headerHeight + rowHeight);
      let x = startX;
      doc.setFillColor(15, 76, 117);
      doc.rect(startX, y, columnWidths.reduce((a, b) => a + b, 0), headerHeight, "F");
      headers.forEach((header, index) => {
        const width = columnWidths[index];
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(header, x + (index >= rightAlignFrom ? width - 8 : 8), y + 14, {
          align: index >= rightAlignFrom ? "right" : "left",
        });
        x += width;
      });
      y += headerHeight;
    };

    drawHeader();

    rows.forEach((row, rowIndex) => {
      ensureSpace(rowHeight);
      let x = startX;
      const highlighted = emphasizeRows.has(rowIndex);
      doc.setFillColor(highlighted ? 255 : rowIndex % 2 === 0 ? 248 : 255, highlighted ? 251 : rowIndex % 2 === 0 ? 250 : 255, highlighted ? 235 : rowIndex % 2 === 0 ? 252 : 255);
      doc.rect(startX, y, columnWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
      doc.setDrawColor(226, 232, 240);
      doc.line(startX, y + rowHeight, startX + columnWidths.reduce((a, b) => a + b, 0), y + rowHeight);

      row.forEach((cell, index) => {
        const width = columnWidths[index];
        doc.setFont("helvetica", highlighted || index === 0 ? "bold" : "normal");
        doc.setFontSize(10);
        doc.setTextColor(index === 0 ? 71 : 15, index === 0 ? 85 : 23, index === 0 ? 105 : 42);
        doc.text(String(cell), x + (index >= rightAlignFrom ? width - 8 : 8), y + 13, {
          align: index >= rightAlignFrom ? "right" : "left",
        });
        x += width;
      });

      y += rowHeight;
    });
  };

  drawText("Tax Finder", margin, { size: 20, color: [15, 76, 117], bold: true });
  y += 16;
  drawText("Income Tax Calculator", margin, { size: 11, color: [100, 116, 139] });
  drawText(`Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, pageWidth - margin, {
    size: 10.5,
    color: [100, 116, 139],
    align: "right",
  });
  y += 24;

  addSection("Summary");
  drawTable(
    ["Item", "Value"],
    [
      ["Gross Salary", fmtCurrency(inputs.grossSalary)],
      ["Recommended Regime", better === "new" ? "New Regime" : "Old Regime"],
      ["Annual Tax Savings", fmtCurrency(saving)],
    ],
    [260, contentWidth - 260],
    { emphasizeRows: new Set([1, 2]) }
  );
  y += 4;
  drawWrapped(`${numberToWords(inputs.grossSalary)} Rupees`, margin, contentWidth);

  addSection("New Regime");
  drawTable(
    ["Particular", "Amount"],
    [
      ["Gross Salary", fmtCurrency(newResult.grossSalary)],
      ["Standard Deduction", `-${fmtCurrency(newResult.standardDeduction)}`],
      ["Taxable Income", fmtCurrency(newResult.taxableIncome)],
      ["Tax on Slabs", fmtCurrency(newResult.taxBeforeRebate)],
      ["Rebate u/s 87A", `-${fmtCurrency(newResult.rebate)}`],
      ["Surcharge", fmtCurrency(newResult.surcharge)],
      ["Cess @ 4%", fmtCurrency(newResult.cess)],
      ["Final Tax Liability", fmtCurrency(newResult.finalTax)],
    ],
    [280, contentWidth - 280],
    { emphasizeRows: new Set([2, 7]) }
  );
  if (better === "new") {
    y += 8;
    drawWrapped("Recommended for your current income and deduction profile.", margin, contentWidth, { size: 10, color: [21, 128, 61], lineGap: 13 });
  }

  addSection("Old Regime");
  const oldRows = [
    ["Gross Salary", fmtCurrency(oldResult.grossSalary)],
    ["Standard Deduction", `-${fmtCurrency(oldResult.standardDeduction)}`],
  ];
  if (oldResult.hraExemption > 0) oldRows.push(["HRA Exemption", `-${fmtCurrency(oldResult.hraExemption)}`]);
  if (oldResult.totalDeductions > 0) oldRows.push(["Other Deductions", `-${fmtCurrency(oldResult.totalDeductions)}`]);
  oldRows.push(
    ["Taxable Income", fmtCurrency(oldResult.taxableIncome)],
    ["Tax on Slabs", fmtCurrency(oldResult.taxBeforeRebate)],
    ["Rebate u/s 87A", `-${fmtCurrency(oldResult.rebate)}`],
    ["Surcharge", fmtCurrency(oldResult.surcharge)],
    ["Cess @ 4%", fmtCurrency(oldResult.cess)],
    ["Final Tax Liability", fmtCurrency(oldResult.finalTax)]
  );
  drawTable(["Particular", "Amount"], oldRows, [280, contentWidth - 280], {
    emphasizeRows: new Set([oldRows.findIndex(([label]) => label === "Taxable Income"), oldRows.length - 1]),
  });
  if (better === "old") {
    y += 8;
    drawWrapped("Recommended because your deductions make the old regime more efficient.", margin, contentWidth, { size: 10, color: [21, 128, 61], lineGap: 13 });
  }

  addSection("Comparison");
  drawTable(
    ["Particular", "New Regime", "Old Regime"],
    [
      ["Taxable Income", fmtCurrency(newResult.taxableIncome), fmtCurrency(oldResult.taxableIncome)],
      ["Tax on Slabs", fmtCurrency(newResult.taxBeforeRebate), fmtCurrency(oldResult.taxBeforeRebate)],
      ["Rebate (87A)", fmtCurrency(newResult.rebate), fmtCurrency(oldResult.rebate)],
      ["Final Tax", fmtCurrency(newResult.finalTax), fmtCurrency(oldResult.finalTax)],
      ["Monthly TDS", fmtCurrency(newResult.monthlyTax), fmtCurrency(oldResult.monthlyTax)],
    ],
    [220, 140, contentWidth - 360],
    { emphasizeRows: new Set([3, 4]), rightAlignFrom: 1 }
  );

  ensureSpace(24);
  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;
  drawWrapped("Informational only. Consult a CA for professional tax advice.", margin, contentWidth, { size: 9.5, color: [148, 163, 184], lineGap: 12 });

  doc.save("Tax-Finder-Income-Tax-Report-FY2025-26.pdf");
}

function downloadCSV(oldResult, newResult, inputs) {
  const better = oldResult.finalTax <= newResult.finalTax ? "Old Regime" : "New Regime";
  const saving = Math.abs(oldResult.finalTax - newResult.finalTax);
  const tips = getSavingsTips(oldResult, newResult, inputs);
  const oldDeductions = oldResult.hraExemption + oldResult.totalDeductions;
  const rows = [
    ["Tax Finder - Income Tax Calculator", "FY 2025-26 (AY 2026-27)", "", ""],
    ["Generated", new Date().toLocaleDateString("en-IN"), "", ""],
    ["Gross Salary", inputs.grossSalary, "", numberToWords(inputs.grossSalary) + " Rupees"],
    ["", "", "", ""],
    ["PARTICULARS", "NEW REGIME (Rs.)", "OLD REGIME (Rs.)", "NOTES"],
    ["Gross Salary", newResult.grossSalary, oldResult.grossSalary, "Annual CTC"],
    ["Standard Deduction", newResult.standardDeduction, oldResult.standardDeduction, "Auto-applied"],
    ["HRA Exemption", 0, oldResult.hraExemption, "Old regime only"],
    ["Other Deductions (80C/80D etc.)", 0, oldResult.totalDeductions, "Old regime only"],
    ["Taxable Income", newResult.taxableIncome, oldResult.taxableIncome, ""],
    ["Tax on Slabs", newResult.taxBeforeRebate, oldResult.taxBeforeRebate, ""],
    ["Rebate u/s 87A", newResult.rebate, oldResult.rebate, ""],
    ["Surcharge", newResult.surcharge, oldResult.surcharge, ""],
    ["Health & Education Cess (4%)", newResult.cess, oldResult.cess, ""],
    ["Final Tax Liability", newResult.finalTax, oldResult.finalTax, ""],
    ["Monthly TDS (approx)", newResult.monthlyTax, oldResult.monthlyTax, ""],
    ["Effective Tax Rate (%)", newResult.effectiveRate, oldResult.effectiveRate, ""],
    ["", "", "", ""],
    ["RECOMMENDED REGIME", better, "", "Lower tax liability"],
    ["Annual Tax Savings", saving, "", "vs other regime"],
    ["", "", "", ""],
    ["DISCLAIMER", "Informational purposes only.", "", ""],
    ["", "Please consult a Chartered Accountant for professional advice.", "", ""],
  ];

  const csv = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Tax-Finder-Income-Tax-Report-FY2025-26.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UI COMPONENTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function downloadFormattedCSV(oldResult, newResult, inputs) {
  const better = oldResult.finalTax <= newResult.finalTax ? "Old Regime" : "New Regime";
  const saving = Math.abs(oldResult.finalTax - newResult.finalTax);
  const tips = getSavingsTips(oldResult, newResult, inputs);
  const oldDeductions = oldResult.hraExemption + oldResult.totalDeductions;

  const rows = [
    ["Tax Finder - Income Tax Calculator Report", "FY 2025-26 (AY 2026-27)", "", ""],
    ["Generated On", new Date().toLocaleDateString("en-IN"), "", ""],
    ["Gross Salary", inputs.grossSalary, "", numberToWords(inputs.grossSalary) + " Rupees"],
    ["Recommended Regime", better, "", "Lower tax liability"],
    ["Annual Tax Savings", saving, "", "Compared with the other regime"],
    ["", "", "", ""],
    ["SUMMARY", "", "", ""],
    ["Metric", "Value", "Notes", ""],
    ["Gross Salary", inputs.grossSalary, "Annual salary entered", ""],
    ["Recommended Regime", better, "Based on current inputs", ""],
    ["Annual Tax Savings", saving, "Final tax difference", ""],
    ["", "", "", ""],
    ["REGIME COMPARISON", "", "", ""],
    ["Particular", "New Regime (Rs.)", "Old Regime (Rs.)", "Notes"],
    ["Gross Salary", newResult.grossSalary, oldResult.grossSalary, "Annual CTC"],
    ["Standard Deduction", newResult.standardDeduction, oldResult.standardDeduction, "Auto-applied"],
    ["Total Old Regime Deductions", 0, oldDeductions, "HRA + other deductions"],
    ["Taxable Income", newResult.taxableIncome, oldResult.taxableIncome, ""],
    ["Tax on Slabs", newResult.taxBeforeRebate, oldResult.taxBeforeRebate, ""],
    ["Rebate u/s 87A", newResult.rebate, oldResult.rebate, ""],
    ["Surcharge", newResult.surcharge, oldResult.surcharge, ""],
    ["Health & Education Cess (4%)", newResult.cess, oldResult.cess, ""],
    ["Final Tax Liability", newResult.finalTax, oldResult.finalTax, "Best decision metric"],
    ["Monthly TDS (Approx.)", newResult.monthlyTax, oldResult.monthlyTax, ""],
    ["Effective Tax Rate (%)", newResult.effectiveRate, oldResult.effectiveRate, ""],
    ["", "", "", ""],
    ["NEW REGIME BREAKDOWN", "", "", ""],
    ["Particular", "Amount", "", ""],
    ["Gross Salary", newResult.grossSalary, "", ""],
    ["Standard Deduction", newResult.standardDeduction, "", ""],
    ["Taxable Income", newResult.taxableIncome, "", ""],
    ["Tax on Slabs", newResult.taxBeforeRebate, "", ""],
    ["Rebate u/s 87A", newResult.rebate, "", ""],
    ["Surcharge", newResult.surcharge, "", ""],
    ["Cess @ 4%", newResult.cess, "", ""],
    ["Final Tax Liability", newResult.finalTax, "", ""],
    ["", "", "", ""],
    ["OLD REGIME BREAKDOWN", "", "", ""],
    ["Particular", "Amount", "", ""],
    ["Gross Salary", oldResult.grossSalary, "", ""],
    ["Standard Deduction", oldResult.standardDeduction, "", ""],
    ["HRA Exemption", oldResult.hraExemption, "", ""],
    ["Other Deductions", oldResult.totalDeductions, "", ""],
    ["Taxable Income", oldResult.taxableIncome, "", ""],
    ["Tax on Slabs", oldResult.taxBeforeRebate, "", ""],
    ["Rebate u/s 87A", oldResult.rebate, "", ""],
    ["Surcharge", oldResult.surcharge, "", ""],
    ["Cess @ 4%", oldResult.cess, "", ""],
    ["Final Tax Liability", oldResult.finalTax, "", ""],
    ["", "", "", ""],
    ["DISCLAIMER", "Informational purposes only.", "", ""],
    ["", "Please consult a Chartered Accountant for professional tax advice.", "", ""],
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Tax-Finder-Income-Tax-Report-FY2025-26.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function AmountHint({ value }) {
  if (!value || value === "0" || value === "") return <div className="h-4" />;
  const num = Number(value);
  if (isNaN(num) || num <= 0) return <div className="h-4" />;
  return (
    <div className="mt-1.5 text-xs text-amber-400/80 font-medium tracking-wide">
      ↳ {numberToWords(num)} Rupees
    </div>
  );
}

function DeductionTooltip({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-bold text-slate-400 transition-colors hover:border-amber-400 hover:text-amber-300"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-64 rounded-xl border border-slate-700 bg-slate-800 p-3 text-xs leading-relaxed text-slate-300 shadow-xl">
          <div>{text}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-xs font-semibold text-amber-400 transition-colors hover:text-amber-300"
          >
            Close
          </button>
        </div>
      )}
    </span>
  );
}

function RupeeInput({ label, hint, value, onChange, placeholder = "0", tooltip, eligibility }) {
  const hasValue = value !== "" && value !== "0";
  return (
    <div className="group">
      <label className={`flex items-center text-xs mb-1 transition-colors ${
        hasValue ? "text-amber-300" : "text-slate-400 group-focus-within:text-amber-300"
      }`}>
        <span>{label}</span>
        {hint && <span className="text-slate-600 ml-1"> · {hint}</span>}
        {tooltip && <DeductionTooltip text={tooltip} />}
      </label>
      {eligibility && (
        <p className="mb-1.5 text-xs text-amber-500/80 leading-relaxed">{eligibility}</p>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(sanitizeDigits(e.target.value))}
          placeholder={placeholder}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm
            focus:outline-none focus:border-amber-400 transition-all placeholder-slate-600"
        />
      </div>
      <AmountHint value={value} />
    </div>
  );
}

function ResultCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-amber-400/10 border border-amber-400/30" : "bg-slate-800/60 border border-slate-700"}`}>
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? "text-amber-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

function SlabTable({ slabs }) {
  if (!slabs || slabs.length === 0) return null;
  const totalTax = slabs.reduce((sum, slab) => sum + (slab.tax || 0), 0);
  return (
    <div className="space-y-1 mt-3">
      {slabs.map((s, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_64px_minmax(88px,1fr)] items-center gap-3 text-xs py-1.5 px-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
          <span className="min-w-0 text-slate-400">{s.range}</span>
          <span className="text-center text-slate-300 font-mono whitespace-nowrap">{s.rate}</span>
          <span className="text-right text-white font-semibold whitespace-nowrap">{fmtCurrency(s.tax)}</span>
        </div>
      ))}
      <div className="grid grid-cols-[minmax(0,1fr)_64px_minmax(88px,1fr)] items-center gap-3 text-xs py-2.5 px-3 bg-amber-400/10 rounded-lg border border-amber-400/30">
        <span className="min-w-0 font-semibold text-white">Total Slab Tax</span>
        <span className="text-center text-amber-300 font-mono whitespace-nowrap">Sum</span>
        <span className="text-right text-amber-400 font-bold whitespace-nowrap">{fmtCurrency(totalTax)}</span>
      </div>
    </div>
  );
}

function TipCard({ tip }) {
  const colors = {
    regime: "border-amber-400/40 bg-amber-400/5",
    invest: "border-emerald-400/40 bg-emerald-400/5",
    info: "border-sky-400/40 bg-sky-400/5",
  };
  return (
    <div className={`rounded-xl p-4 border ${colors[tip.type]} flex gap-3`}>
      <span className="text-2xl leading-none mt-0.5">{tip.icon}</span>
      <div>
        <div className="text-sm font-semibold text-white mb-0.5">{tip.label}</div>
        <div className="text-xs text-slate-400 leading-relaxed">{tip.detail}</div>
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    question: "Which tax regime is better for salaried employees?",
    answer:
      "It depends on your salary structure, HRA, and deductions. Tax Finder compares both regimes instantly and highlights whichever gives the lower final tax based on your inputs.",
  },
  {
    question: "Does this calculator include surcharge and cess?",
    answer:
      "Yes. The calculator includes Health and Education Cess at 4% and applies surcharge based on taxable income thresholds. It also considers marginal relief near surcharge thresholds.",
  },
  {
    question: "Can I claim HRA in the new regime?",
    answer:
      "No. HRA exemption is generally available only under the old regime, which is why the tool uses HRA details only for old-regime tax calculation.",
  },
  {
    question: "Which deductions are available in the old regime?",
    answer:
      "The old regime supports the broader deductions set in this tool, including 80C, 80CCD(1B), 80D, home loan interest, and advanced sections such as 80E, 80G, 80TTA or 80TTB, and more where eligible.",
  },
  {
    question: "Does the calculator support 80CCD(2) employer NPS?",
    answer:
      "Yes. Tax Finder supports 80CCD(2) and caps it using Basic plus DA and employer type. This deduction is one of the few deductions that can also apply in the new regime.",
  },
  {
    question: "Can I claim medical insurance in this calculator?",
    answer:
      "Yes. The calculator supports Section 80D for health insurance premiums. You can enter separate amounts for self and family and for parents, and senior citizen limits are handled separately.",
  },
];

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Frequently Asked Questions</div>
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question} className="rounded-xl border border-slate-800 bg-slate-800/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
              >
                <span className={`text-sm font-semibold transition-colors ${isOpen ? "text-white" : "text-slate-300"}`}>
                  {item.question}
                </span>
                <span className={`text-xs font-bold transition-colors ${isOpen ? "text-amber-400" : "text-slate-500"}`}>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-700/50 px-4 py-3 text-sm leading-relaxed text-slate-400">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuideModal({ open, onClose }) {
  if (!open) return null;

  const allDeductions = [...BASIC_DEDUCTIONS, ...ADVANCED_DEDUCTIONS];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="text-sm font-bold text-white">How To Use This Tool</div>
            <div className="mt-1 text-xs text-slate-400">
              A quick guide to salary inputs, regimes, and deduction limits for FY 2025-26.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Best Way To Use It</div>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-200">
              <p>1. Enter your annual or monthly gross salary at the top.</p>
              <p>2. Add HRA details only if you pay rent and want old-regime HRA exemption.</p>
              <p>3. Fill only the deductions you genuinely qualify for.</p>
              <p>4. Use the comparison card to choose the lower final tax after cess.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Regime Rules</div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <p><span className="font-semibold text-white">Old Regime:</span> uses HRA and most deductions.</p>
                <p><span className="font-semibold text-white">New Regime:</span> ignores most deductions and currently allows only 80CCD(2) in this tool.</p>
                <p><span className="font-semibold text-white">Final decision:</span> compare the final tax after 4% cess.</p>
              </div>
            </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Important Notes</div>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <p><span className="font-semibold text-white">80CCD(2):</span> capped from Basic + DA and employer type.</p>
              <p><span className="font-semibold text-white">80C group:</span> 80C, 80CCC, and 80CCD(1) share one combined limit.</p>
              <p><span className="font-semibold text-white">Medical sections:</span> senior citizen rules can change the cap.</p>
              <p><span className="font-semibold text-white">Surcharge:</span> applies on taxable income, not gross salary. It starts at 10% above ₹50 lakh and 15% above ₹1 crore, with higher bands beyond that.</p>
            </div>
          </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Deduction Limits In This Tool</div>
            <div className="mt-4 space-y-3">
              {allDeductions.map((d) => (
                <div key={d.id} className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{d.section}</span>
                    <span className="text-sm text-slate-300">{d.label.split("-").slice(1).join("-").trim() || d.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      d.regimes.includes("new")
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-slate-700 text-slate-300"
                    }`}>
                      {d.regimes.includes("new") ? "Old + New" : "Old only"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-amber-300">{d.capNote || "Check eligibility rules"}</div>
                  {d.eligibility && (
                    <div className="mt-2 text-xs leading-relaxed text-slate-400">{d.eligibility}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedDeductionsPanel({ form, set, isSenior }) {
  const [open, setOpen] = useState(false);
  const npsUsesHraBasic = form.showHRA && form.basicLakh;
  const npsBasicSalary =
    form.showHRA && form.hraInputMode === "monthly"
      ? (Number(form.basicLakh) || 0) * 12
      : Number(form.basicLakh) || 0;
  const npsDa = Number(form.daLakh) || 0;
  const npsCap = getEffectiveCap("section80CCD2", {
    basicSalary: npsBasicSalary,
    da: npsDa,
    employerType: form.npsEmployerType || "private",
  });

  const visibleAdvanced = ADVANCED_DEDUCTIONS.filter((d) => {
    if (d.isSeniorOnly && !isSenior) return false;
    if (d.isSeniorExcluded && isSenior) return false;
    return true;
  });

  const filledCount = visibleAdvanced.filter((d) => form[d.id] && form[d.id] !== "0").length;

  return (
    <div className="border-t border-slate-700/50 pt-3 mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
          open
            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
            : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-white"
        }`}
      >
        <span className="flex items-center gap-2">
          {open ? "▲" : "▼"}
          {open ? "Hide Advanced Deductions" : "Show More Deductions"}
          <span className={open ? "text-amber-200/70" : "text-slate-500"}>({visibleAdvanced.length} available)</span>
        </span>
        {filledCount > 0 && (
          <span className="bg-amber-400/20 text-amber-400 border border-amber-400/30 rounded-full px-2 py-0.5 text-[10px] font-bold">
            {filledCount} added
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500 italic">
            These are less common deductions. Open the info icon for guidance and only enter values you actually qualify for.
          </p>
          {visibleAdvanced.map((d) => (
            <div key={d.id} className="space-y-3">
              <RupeeInput
                label={`${d.section} - ${d.label.split("-").slice(1).join("-").trim() || d.label}`}
                hint={d.capNote}
                tooltip={d.description}
                eligibility={d.eligibility}
                value={form[d.id] || ""}
                onChange={set(d.id)}
              />
              {d.id === "section80CCD2" && form.section80CCD2 !== "" && (
                <div className="rounded-xl border border-slate-700/70 bg-slate-800/40 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      NPS Cap Setup
                    </div>
                    <div className="inline-flex rounded-full border border-slate-700 bg-slate-800/80 p-1">
                      {[
                        ["private", "Private / Other"],
                        ["central_govt", "Central Govt"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => set("npsEmployerType")(key)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                            (form.npsEmployerType || "private") === key
                              ? "bg-amber-400 text-slate-900"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">
                    {npsUsesHraBasic
                      ? "Using Basic Salary from HRA details for the 80CCD(2) cap."
                      : "Enter annual Basic Salary and DA so we can validate the 80CCD(2) cap correctly."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <RupeeInput
                      label="Basic Salary for 80CCD(2)"
                      hint={npsUsesHraBasic && form.hraInputMode === "monthly" ? "Using HRA monthly value" : "Annual"}
                      value={form.basicLakh}
                      onChange={set("basicLakh")}
                      placeholder="e.g. 600000"
                    />
                    <RupeeInput
                      label="DA for 80CCD(2)"
                      hint="Annual, optional"
                      value={form.daLakh}
                      onChange={set("daLakh")}
                      placeholder="e.g. 0"
                    />
                  </div>
                  <div className={`rounded-lg border px-3 py-2 text-xs ${
                    npsCap > 0
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                  }`}>
                    {npsCap > 0
                      ? `Allowed cap right now: ${fmtCurrency(npsCap)} based on ${form.npsEmployerType === "central_govt" ? "Central Govt" : "Private / Other"} and Basic + DA. Higher values will be capped automatically.`
                      : "Enter Basic Salary to activate the 80CCD(2) cap. Until then, this deduction will be capped to ₹0."}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN COMPONENT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EMPTY = {
  grossLakh: "", grossInputMode: "annual", age: "30", showHRA: false,
  hraInputMode: "annual",
  basicLakh: "", daLakh: "", hraReceivedLakh: "", rentPaidLakh: "", city: "",
  npsEmployerType: "private",
  section80C: "", section80CCD1B: "", section80D_self: "", section80D_parents: "", homeLoanInterest: "",
  section80CCD2: "", section80E: "", section80EE: "", section80EEA: "",
  section80G: "", section80GG: "", section80TTA: "", section80TTB: "",
  section80DD: "", section80DDB: "", section80U: "", professionalTax: "",
  childrenEducationAllowance: "",
  selfSenior: false, parentsSenior: false,
};

export default function TaxCalculator() {
  const [form, setForm] = useState(EMPTY);
  const [results, setResults] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showGuideNudge, setShowGuideNudge] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("new");
  const [calculated, setCalculated] = useState(false);
  const [mobileScreen, setMobileScreen] = useState("form");
  const [showStickyBrand, setShowStickyBrand] = useState(false);

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handleReset = () => {
    setForm(EMPTY);
    setResults(null);
    setErrors({});
    setCalculated(false);
    setShowDetail(false);
    setActiveTab("new");
    setMobileScreen("form");
  };

  const handleCalculate = useCallback(() => {
    const grossMultiplier = form.grossInputMode === "monthly" ? 12 : 1;
    const grossSalary = (Number(form.grossLakh) || 0) * grossMultiplier;
    if (!grossSalary) {
      setErrors({ grossLakh: "Gross salary is required." });
      return;
    }
    setErrors({});
    const hraMultiplier = form.hraInputMode === "monthly" ? 12 : 1;
    const input = {
      grossSalary,
      age: parseInt(form.age) || 30,
      basicSalary: (Number(form.basicLakh) || 0) * hraMultiplier,
      da: Number(form.daLakh) || 0,
      hraReceived: (Number(form.hraReceivedLakh) || 0) * hraMultiplier,
      rentPaid: (Number(form.rentPaidLakh) || 0) * hraMultiplier,
      city: form.city,
      deductions: {
        section80C: Number(form.section80C) || 0,
        section80CCD1B: Number(form.section80CCD1B) || 0,
        section80D_self: Number(form.section80D_self) || 0,
        section80D_parents: Number(form.section80D_parents) || 0,
        homeLoanInterest: Number(form.homeLoanInterest) || 0,
        section80CCD2: Number(form.section80CCD2) || 0,
        section80E: Number(form.section80E) || 0,
        section80EE: Number(form.section80EE) || 0,
        section80EEA: Number(form.section80EEA) || 0,
        section80G: Number(form.section80G) || 0,
        section80GG: Number(form.section80GG) || 0,
        section80TTA: Number(form.section80TTA) || 0,
        section80TTB: Number(form.section80TTB) || 0,
        section80DD: Number(form.section80DD) || 0,
        section80DDB: Number(form.section80DDB) || 0,
        section80U: Number(form.section80U) || 0,
        professionalTax: Number(form.professionalTax) || 0,
        childrenEducationAllowance: Number(form.childrenEducationAllowance) || 0,
        employerType: form.npsEmployerType || "private",
        selfIsSenior: form.selfSenior,
        parentsAreSenior: form.parentsSenior,
      },
    };
    const oldResult = calculateTaxEngine({ ...input, regime: "old" });
    const newResult = calculateTaxEngine({ ...input, regime: "new" });
    setResults({ old: oldResult, new: newResult, inputs: input });
    setCalculated(true);
    setActiveTab(oldResult.finalTax <= newResult.finalTax ? "old" : "new");
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileScreen("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [form]);

  const betterRegime = results ? (results.old.finalTax <= results.new.finalTax ? "old" : "new") : null;
  const saving = results ? Math.abs(results.old.finalTax - results.new.finalTax) : 0;
  const showMobileResults = mobileScreen === "results";
  const isMonthlyGrossInput = form.grossInputMode === "monthly";
  const isMonthlyHraInput = form.hraInputMode === "monthly";

  useEffect(() => {
    const onScroll = () => setShowStickyBrand(window.scrollY > 180);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const storageKey = "taxfinder-guide-nudge-seen";
    try {
      if (window.localStorage.getItem(storageKey)) return;
      setShowGuideNudge(true);
      window.localStorage.setItem(storageKey, "true");
      const timer = window.setTimeout(() => setShowGuideNudge(false), 5000);
      return () => window.clearTimeout(timer);
    } catch {
      setShowGuideNudge(true);
      const timer = window.setTimeout(() => setShowGuideNudge(false), 5000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  return (
    <div className="min-h-screen text-white" style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: "radial-gradient(ellipse at 20% 0%, #1e293b 0%, #0f172a 50%, #020617 100%)",
    }}>
      <GuideModal open={showGuide} onClose={() => setShowGuide(false)} />
      <div className={`fixed left-1/2 top-3 z-40 -translate-x-1/2 transition-all duration-300 ${
        showStickyBrand ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0 pointer-events-none"
      }`}>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="rounded-full border border-amber-300/30 bg-amber-400 px-4 py-1.5 text-xs font-black tracking-[0.12em] text-slate-950 shadow-lg shadow-amber-400/20 transition-transform hover:scale-[1.02]"
        >
          TAX FINDER
        </button>
      </div>
      <header className="relative z-20 w-full border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          <div className="font-bold text-sm sm:text-base tracking-wide text-white">
            <a href="https://www.vishalbuilds.com/" className="hover:text-amber-400 transition-colors">
              Vishal Builds
            </a>
          </div>
          <nav className="flex gap-3 sm:gap-5 text-[11px] sm:text-xs font-medium text-slate-300" aria-label="Shared navigation">
            <a href="https://www.vishalbuilds.com/" className="hover:text-white transition-colors">Home</a>
            <a href="https://www.vishalbuilds.com/#projects" className="hover:text-white transition-colors">Products</a>
            <a href="https://about.vishalbuilds.com/" className="hover:text-white transition-colors">About</a>
          </nav>
        </div>
      </header>
      {/* Header */}
      <div className="border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-slate-900 font-black text-base">$</div>
            <div>
              <div className="font-bold text-sm text-white tracking-tight">Tax Finder</div>
              <div className="text-xs text-slate-500">FY 2025-26 · Free · No signup</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 text-amber-400 text-xs font-semibold mb-4">
            Updated for Budget 2025-26
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
            Income Tax Calculator<br/>
            <span className="text-amber-400">Old vs New Regime</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            Enter your salary and investments. We'll compare both regimes instantly and tell you exactly where you stand.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-4">

            {/* Income */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Your Income</div>
                <div className="relative flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    title="Tax information"
                    className="group relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-300/55 bg-sky-500 text-xs font-bold text-white shadow-md shadow-sky-500/25 transition-all hover:border-sky-200 hover:bg-sky-400 hover:text-white hover:shadow-sky-400/30"
                    aria-label="How to use this tool"
                  >
                    i
                    <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-full border border-sky-400/25 bg-slate-900/95 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-sky-200 opacity-0 transition-all duration-200 group-hover:opacity-100">
                      Tax Information
                    </span>
                  </button>
                  {showGuideNudge && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-sky-300/30 bg-slate-900/95 p-3 text-left shadow-xl shadow-sky-900/20 backdrop-blur">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-widest text-sky-300">Start Here</div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-300">
                            Tap the blue <span className="font-semibold text-white">i</span> button for tax information, deduction limits, and how to use this tool.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGuideNudge(false)}
                          className="text-xs font-semibold text-slate-400 transition-colors hover:text-white"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="inline-flex rounded-full border border-slate-700 bg-slate-800/80 p-1">
                    {[["annual", "Annual"], ["monthly", "Monthly"]].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => set("grossInputMode")(key)}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                          form.grossInputMode === key
                            ? "bg-amber-400 text-slate-900"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleReset}
                    className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold text-rose-200 transition-all hover:border-rose-300/50 hover:bg-rose-400/15 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="group">
                <label className={`block text-xs font-semibold uppercase tracking-widest mb-1.5 transition-colors ${
                  errors.grossLakh
                    ? "text-red-400"
                    : form.grossLakh !== "" && form.grossLakh !== "0"
                    ? "text-amber-300"
                    : "text-slate-400 group-focus-within:text-amber-300"
                }`}>
                  {isMonthlyGrossInput ? "Gross Salary" : "Annual Gross Salary"}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-sm">₹</span>
                  <input type="text" inputMode="numeric" value={form.grossLakh} onChange={e => {
                    set("grossLakh")(sanitizeDigits(e.target.value));
                    if (errors.grossLakh) setErrors((prev) => ({ ...prev, grossLakh: undefined }));
                  }}
                    placeholder={isMonthlyGrossInput ? "e.g. 100000" : "e.g. 1200000"}
                    className={`w-full bg-slate-800 border rounded-xl pl-8 pr-4 py-3.5 text-white text-base font-semibold
                      focus:outline-none transition-all placeholder-slate-600 ${
                        errors.grossLakh
                          ? "border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                          : "border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                      }`} />
                </div>
                {errors.grossLakh && (
                  <p className="mt-2 text-xs font-medium text-red-400">{errors.grossLakh}</p>
                )}
                {isMonthlyGrossInput && (
                  <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] font-medium text-amber-300">
                    Enter monthly gross salary. We&apos;ll convert it to annual automatically.
                  </p>
                )}
                <AmountHint value={form.grossLakh} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Your Age</label>
                <div className="grid grid-cols-3 gap-2">
                  {[["Below 60", "30"], ["60 – 79", "65"], ["80 and above", "82"]].map(([label, val]) => (
                    <button key={val} onClick={() => set("age")(val)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.age === val ? "bg-amber-400 border-amber-400 text-slate-900" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* HRA */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">HRA Details</div>
                <div className="flex items-center gap-2">
                  {form.showHRA && (
                    <div className="inline-flex rounded-full border border-slate-700 bg-slate-800/80 p-1">
                      {[["annual", "Annual"], ["monthly", "Monthly"]].map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => set("hraInputMode")(key)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                            form.hraInputMode === key
                              ? "bg-amber-400 text-slate-900"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => set("showHRA")(!form.showHRA)}
                    className={`text-xs px-3 py-1 rounded-full border transition-all font-semibold ${
                      form.showHRA ? "bg-amber-400 border-amber-400 text-slate-900" : "border-slate-600 text-slate-400 hover:border-slate-400"
                    }`}>{form.showHRA ? "Added ✓" : "I pay rent"}</button>
                </div>
              </div>
              {form.showHRA ? (
                <div className="space-y-3">
                  {isMonthlyHraInput && (
                    <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] font-medium text-amber-300">
                      Enter monthly values. We&apos;ll convert them to annual automatically.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <RupeeInput label="Basic Salary" hint={isMonthlyHraInput ? "Monthly" : "Annual"} value={form.basicLakh} onChange={set("basicLakh")} placeholder={isMonthlyHraInput ? "e.g. 50000" : "e.g. 600000"} />
                    <RupeeInput label="HRA Received" hint={isMonthlyHraInput ? "Monthly" : "Annual"} value={form.hraReceivedLakh} onChange={set("hraReceivedLakh")} placeholder={isMonthlyHraInput ? "e.g. 16000" : "e.g. 200000"} />
                  </div>
                  <RupeeInput label={isMonthlyHraInput ? "Rent Paid" : "Annual Rent Paid"} hint={isMonthlyHraInput ? "Monthly" : "Annual"} value={form.rentPaidLakh} onChange={set("rentPaidLakh")} placeholder={isMonthlyHraInput ? "e.g. 15000" : "e.g. 180000"} />
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">City</label>
                    <select value={form.city} onChange={e => set("city")(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400 transition-all">
                      <option value="">Non-Metro (40%)</option>
                      <option value="mumbai">Mumbai (50%)</option>
                      <option value="delhi">Delhi (50%)</option>
                      <option value="kolkata">Kolkata (50%)</option>
                      <option value="chennai">Chennai (50%)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Click "I pay rent" to add HRA details for old regime.</p>
              )}
            </div>

            {/* Deductions */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Investments & Deductions</div>
              <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-300 leading-relaxed">
                Old Regime uses all deductions. New Regime uses {NEW_REGIME_DEDUCTIONS.map((d) => d.section).join(", ") || "none"}.
              </p>
              {BASIC_DEDUCTIONS.map((d) => (
                <RupeeInput
                  key={d.id}
                  label={d.label}
                  hint={d.capNote}
                  tooltip={d.description}
                  eligibility={d.eligibility}
                  value={form[d.id] || ""}
                  onChange={set(d.id)}
                />
              ))}
              <div className="flex gap-4 pt-1">
                {[["selfSenior", "Self is Senior (60+)", form.selfSenior],
                  ["parentsSenior", "Parents are Senior", form.parentsSenior]].map(([key, label, val]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={val} onChange={e => set(key)(e.target.checked)} className="w-4 h-4 rounded accent-amber-400" />
                    <span className="text-xs text-slate-400">{label}</span>
                  </label>
                ))}
              </div>
              <AdvancedDeductionsPanel form={form} set={set} isSenior={(parseInt(form.age, 10) || 30) >= 60} />
            </div>

            {/* Buttons */}
            <button onClick={handleCalculate}
              className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-base rounded-2xl
                transition-all duration-200 shadow-lg shadow-amber-400/20 active:scale-95"
              style={{ letterSpacing: "-0.01em" }}>
              Calculate My Tax {"->"}
            </button>
            {calculated && (
              <button onClick={handleReset}
                className="w-full py-3 bg-rose-400/8 hover:bg-rose-400/14 text-rose-200 hover:text-white font-semibold text-sm
                  rounded-2xl border border-rose-400/25 hover:border-rose-300/45 transition-all duration-200">
                ↺ Reset & Start Over
              </button>
            )}
          </div>

          {/* RIGHT */}
          <div className={`lg:col-span-3 space-y-4 fixed inset-0 z-40 overflow-y-auto bg-slate-950 px-4 py-6 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:px-0 lg:py-0 lg:transition-none ${
            showMobileResults ? "translate-x-0" : "translate-x-full pointer-events-none"
          } lg:translate-x-0 lg:pointer-events-auto`}>
            {!calculated ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 bg-slate-900/40 border border-slate-800 rounded-2xl">
                <div className="text-5xl mb-4">🧮</div>
                <div className="text-white font-bold text-lg mb-2">Enter your details</div>
                <div className="text-slate-500 text-sm max-w-xs">Fill in your salary and investments on the left, then click Calculate.</div>
              </div>
            ) : (
              <>
                <div className="lg:hidden sticky top-3 z-10 mb-4 flex justify-start">
                  <button
                    onClick={() => {
                      setMobileScreen("form");
                      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur"
                  >
                    ← Back to Calculator
                  </button>
                </div>

                {/* Winner Banner */}
                <div className={`rounded-2xl p-5 flex items-center justify-between gap-4 ${
                  betterRegime === "new"
                    ? "bg-gradient-to-r from-amber-400/20 to-amber-400/5 border border-amber-400/30"
                    : "bg-gradient-to-r from-emerald-400/20 to-emerald-400/5 border border-emerald-400/30"
                }`}>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Best Regime for You</div>
                    <div className="text-2xl font-black text-white" style={{ letterSpacing: "-0.02em" }}>
                      {betterRegime === "new" ? "🆕 New Regime" : "🏛️ Old Regime"}
                    </div>
                    <div className="text-sm text-slate-300 mt-0.5">
                      Saves you <span className="font-bold text-white">{fmtCurrency(saving)}</span> vs the other regime
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => downloadRealPDF(results.old, results.new, results.inputs)}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20
                        rounded-xl px-4 py-2.5 transition-all text-white text-xs font-semibold whitespace-nowrap">
                      📄 Download PDF
                    </button>
                    <button onClick={() => downloadFormattedCSV(results.old, results.new, results.inputs)}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20
                        rounded-xl px-4 py-2.5 transition-all text-white text-xs font-semibold whitespace-nowrap">
                      📊 Download CSV
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="flex border-b border-slate-800">
                    {[["new", "🆕 New Regime"], ["old", "🏛️ Old Regime"]].map(([key, label]) => (
                      <button key={key} onClick={() => setActiveTab(key)}
                        className={`flex-1 py-3.5 text-sm font-semibold transition-all relative ${activeTab === key ? "text-white" : "text-slate-500 hover:text-slate-300"}`}>
                        {label}
                        {betterRegime === key && <span className="ml-2 text-xs bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full font-bold">Best</span>}
                        {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-5 space-y-4">
                    {results && (() => {
                      const r = results[activeTab];
                      const deductionRows = getDeductionRows(r, activeTab);
                      const surchargeMeta = getSurchargeMeta(r, activeTab);
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <ResultCard label="Final Tax" value={fmtCurrency(r.finalTax)} highlight />
                            <ResultCard label="Monthly TDS" value={fmtCurrency(r.monthlyTax)} />
                            <ResultCard label="Taxable Income" value={fmtCurrency(r.taxableIncome)} />
                            <ResultCard label="Effective Rate" value={r.effectiveRate + "%"} />
                          </div>
                          <div className="bg-slate-800/40 rounded-xl overflow-hidden">
                            {[
                              { label: "Gross Salary", value: r.grossSalary },
                              { label: "Standard Deduction", value: -r.standardDeduction },
                              activeTab === "old" && r.hraExemption > 0 && { label: "HRA Exemption", value: -r.hraExemption },
                              ...deductionRows,
                              { label: "= Taxable Income", value: r.taxableIncome, bold: true },
                              { label: "Tax on Slabs", value: r.taxBeforeRebate },
                              r.rebate > 0 && { label: "Rebate u/s 87A", value: -r.rebate },
                              { label: `Surcharge (${surchargeMeta.rate}%)`, value: r.surcharge, info: surchargeMeta.info },
                              { label: "Health & Education Cess (4%)", value: r.cess },
                              { label: "= Final Tax Liability", value: r.finalTax, bold: true },
                            ].filter(Boolean).map((row, i) => (
                              <div key={i} className={`flex justify-between items-center px-4 py-2.5 text-sm border-b border-slate-700/50 last:border-0 ${row.bold ? "bg-slate-700/30" : ""}`}>
                                <span className={`${row.bold ? "font-bold text-white" : "text-slate-400"} flex items-center`}>
                                  {row.label}
                                  {row.info && <DeductionTooltip text={row.info} />}
                                </span>
                                <span className={`font-mono ${row.bold ? "font-bold text-amber-400" : row.value < 0 ? "text-emerald-400" : "text-white"}`}>
                                  {row.value < 0 ? `-${fmtCurrency(Math.abs(row.value))}` : fmtCurrency(row.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                          {r.slabBreakdown.length > 0 && (
                            <div>
                              <button onClick={() => setShowDetail(!showDetail)}
                                className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors">
                                {showDetail ? "▲ Hide" : "▼ Show"} slab-by-slab breakdown
                              </button>
                              {showDetail && <SlabTable slabs={r.slabBreakdown} />}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Compare */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Side-by-Side Comparison</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div />
                    <div className={`text-center font-bold py-1 rounded-lg ${betterRegime === "new" ? "text-amber-400 bg-amber-400/10" : "text-slate-300"}`}>New</div>
                    <div className={`text-center font-bold py-1 rounded-lg ${betterRegime === "old" ? "text-amber-400 bg-amber-400/10" : "text-slate-300"}`}>Old</div>
                    {[
                      ["Taxable Income", results.new.taxableIncome, results.old.taxableIncome],
                      ["Tax on Slabs", results.new.taxBeforeRebate, results.old.taxBeforeRebate],
                      ["Rebate (87A)", results.new.rebate, results.old.rebate],
                      ["Cess @ 4%", results.new.cess, results.old.cess],
                      ["Final Tax (after cess 4%)", results.new.finalTax, results.old.finalTax],
                      ["Monthly TDS", results.new.monthlyTax, results.old.monthlyTax],
                    ].map(([label, nv, ov]) => (
                      <Fragment key={label}>
                        <div className="text-slate-400 flex items-center">{label}</div>
                        <div className={`text-center font-mono py-1 ${nv < ov ? "text-emerald-400 font-bold" : "text-slate-300"}`}>{fmtCurrency(nv)}</div>
                        <div className={`text-center font-mono py-1 ${ov < nv ? "text-emerald-400 font-bold" : "text-slate-300"}`}>{fmtCurrency(ov)}</div>
                      </Fragment>
                    ))}
                  </div>
                </div>

                {/* Tips */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">💡 Tax Saving Recommendations</div>
                  {getSavingsTips(results.old, results.new, results.inputs).map((tip, i) => (
                    <TipCard key={i} tip={tip} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-8">
          <FAQAccordion />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            For informational purposes only. Please consult a qualified tax professional for personal tax advice.
          </p>
        </div>

                {/* Footer */}
        <div className="mt-12 text-center text-xs text-slate-600 border-t border-slate-800 pt-6">
          <p className="font-semibold text-sky-300">Made by Vishal.</p>
          <p className="mt-1">
            <a
              href="https://vishalbuilds.com"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              Website
            </a>
            {" · "}
            <a
              href="mailto:vgvishal31@gmail.com"
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              Email
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
