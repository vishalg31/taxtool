export const DEDUCTIONS_CONFIG = [
  {
    id: "section80C",
    enabled: true,
    section: "80C",
    label: "80C - PPF, ELSS, LIC, EPF",
    description:
      "Covers PPF, ELSS mutual funds, LIC premiums, EPF employee contribution, NSC, 5-year tax-saving FD, tuition fees for up to 2 children, and principal repayment of home loan. Combined cap with 80CCC and 80CCD(1).",
    cap: 150000,
    capNote: "Max Rs 1,50,000 (combined with 80CCC + 80CCD(1))",
    regimes: ["old"],
    group: "basic",
    inputType: "amount",
    eligibility: null,
    combinedWith: ["section80CCC", "section80CCD1"],
    combinedCap: 150000,
  },
  {
    id: "section80CCD1B",
    enabled: true,
    section: "80CCD(1B)",
    label: "80CCD(1B) - NPS Extra",
    description:
      "Additional employee contribution to National Pension System over and above the Rs 1.5 lakh limit of Section 80C.",
    cap: 50000,
    capNote: "Max Rs 50,000 (in addition to 80C limit)",
    regimes: ["old"],
    group: "basic",
    inputType: "amount",
    eligibility: null,
  },
  {
    id: "section80D_self",
    enabled: true,
    section: "80D",
    label: "80D - Health Insurance (Self & Family)",
    description:
      "Premium paid for health insurance covering yourself, spouse, and dependent children. Preventive health check-up costs up to Rs 5,000 are included within this limit.",
    cap: 50000,
    capNote: "Max Rs 25,000 (Rs 50,000 if you are a senior citizen)",
    regimes: ["old"],
    group: "basic",
    inputType: "amount",
    eligibility: null,
  },
  {
    id: "section80D_parents",
    enabled: true,
    section: "80D",
    label: "80D - Health Insurance (Parents)",
    description:
      "Premium paid for health insurance for your parents. This limit is separate from the self and family limit above.",
    cap: 50000,
    capNote: "Max Rs 25,000 (Rs 50,000 if parents are senior citizens)",
    regimes: ["old"],
    group: "basic",
    inputType: "amount",
    eligibility: null,
  },
  {
    id: "homeLoanInterest",
    enabled: true,
    section: "24(b)",
    label: "Home Loan Interest - Sec 24(b)",
    description:
      "Interest paid on a home loan for a self-occupied property. For a let-out property there is technically no upper cap, but loss from house property can only offset salary income up to Rs 2 lakh per year.",
    cap: 200000,
    capNote: "Max Rs 2,00,000 for self-occupied property",
    regimes: ["old"],
    group: "basic",
    inputType: "amount",
    eligibility: null,
  },
  {
    id: "section80CCD2",
    enabled: true,
    section: "80CCD(2)",
    label: "80CCD(2) - Employer NPS Contribution",
    description:
      "Employer contribution to your NPS account. This is not part of the Rs 1.5 lakh 80C cap and is available in both old and new regimes.",
    cap: null,
    capNote: "Up to 10% of Basic+DA (private sector) or 14% (central govt). Check salary slip.",
    regimes: ["old", "new"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Enter only your employer's NPS contribution, not your own contribution. Check your salary slip for an employer NPS component.",
  },
  {
    id: "section80E",
    enabled: true,
    section: "80E",
    label: "80E - Education Loan Interest",
    description:
      "Interest paid on an education loan for higher studies for yourself, spouse, children, or a student for whom you are the legal guardian.",
    cap: null,
    capNote: "No cap - full interest is deductible",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Available for up to 8 consecutive years from the year repayment begins, or until the interest is fully repaid, whichever is earlier. Principal repayment is not deductible here.",
  },
  {
    id: "section80EE",
    enabled: true,
    section: "80EE",
    label: "80EE - Home Loan (First-Time Buyer, 2016-17)",
    description:
      "Additional home loan interest deduction for first-time home buyers over and above Section 24(b), subject to a narrow sanction window.",
    cap: 50000,
    capNote: "Max Rs 50,000 (additional, over Section 24(b))",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Only for loans sanctioned between 1 Apr 2016 and 31 Mar 2017, with loan value up to Rs 35 lakh and property value up to Rs 50 lakh. You must not own another residential property.",
  },
  {
    id: "section80EEA",
    enabled: true,
    section: "80EEA",
    label: "80EEA - Affordable Housing Loan (2019-22)",
    description:
      "Additional home loan interest deduction for affordable housing over and above Section 24(b), for eligible first-time buyers.",
    cap: 150000,
    capNote: "Max Rs 1,50,000 (additional, over Section 24(b))",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Loan must be sanctioned between 1 Apr 2019 and 31 Mar 2022, property stamp duty value must be up to Rs 45 lakh, and you must not own another residential property on the sanction date. Do not claim both 80EE and 80EEA.",
  },
  {
    id: "section80G",
    enabled: true,
    section: "80G",
    label: "80G - Donations to Charities",
    description:
      "Deduction for donations to approved funds and charitable institutions. Depending on the organisation, the deductible amount may be 50% or 100% of the donation, with or without a qualifying limit.",
    cap: null,
    capNote: "Enter the deductible amount from your 80G receipt",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Enter the deductible amount, not the raw donation. Cash donations above Rs 2,000 are not eligible.",
  },
  {
    id: "section80GG",
    enabled: true,
    section: "80GG",
    label: "80GG - Rent Paid (No HRA in Salary)",
    description:
      "For salaried individuals who do not receive HRA from their employer but do pay rent.",
    cap: 60000,
    capNote: "Max Rs 60,000 per year (Rs 5,000 per month)",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Only if your employer does not pay you HRA. Do not claim both HRA exemption and 80GG.",
  },
  {
    id: "section80TTA",
    enabled: true,
    section: "80TTA",
    label: "80TTA - Savings Account Interest",
    description:
      "Deduction on interest earned from savings accounts with banks, post offices, or co-operative societies.",
    cap: 10000,
    capNote: "Max Rs 10,000 (savings account interest only)",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Only available to individuals below 60 years of age. Senior citizens should use Section 80TTB instead.",
    isSeniorExcluded: true,
  },
  {
    id: "section80TTB",
    enabled: true,
    section: "80TTB",
    label: "80TTB - Interest Income (Senior Citizens Only)",
    description:
      "For resident senior citizens, deduction on interest from savings accounts, fixed deposits, and recurring deposits.",
    cap: 50000,
    capNote: "Max Rs 50,000 (senior citizens only)",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Available only to resident individuals aged 60 years or above.",
    isSeniorOnly: true,
  },
  {
    id: "section80DD",
    enabled: true,
    section: "80DD",
    label: "80DD - Disabled Dependent",
    description:
      "Fixed deduction for medical treatment, training, and rehabilitation of a dependent with a disability.",
    cap: 125000,
    capNote: "Rs 75,000 for disability >= 40% | Rs 1,25,000 for severe disability >= 80%",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Enter Rs 75,000 or Rs 1,25,000 based on the valid disability certificate. This is a fixed amount, not actual spend.",
  },
  {
    id: "section80DDB",
    enabled: true,
    section: "80DDB",
    label: "80DDB - Specified Disease Treatment",
    description:
      "Deduction for medical treatment of specified diseases for yourself or a dependent.",
    cap: 100000,
    capNote: "Rs 40,000 (below 60) | Rs 1,00,000 (senior citizen)",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "The claim should be reduced by any reimbursement received from an insurer or employer.",
  },
  {
    id: "section80U",
    enabled: true,
    section: "80U",
    label: "80U - Self Disability",
    description:
      "Fixed deduction if the taxpayer themselves has a certified disability.",
    cap: 125000,
    capNote: "Rs 75,000 (disability >= 40%) | Rs 1,25,000 (severe disability >= 80%)",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Enter Rs 75,000 or Rs 1,25,000 based on the valid disability certificate. This is a fixed amount.",
  },
  {
    id: "professionalTax",
    enabled: true,
    section: "16(iii)",
    label: "Professional Tax",
    description:
      "Professional tax deducted by your employer from salary and paid to the state government.",
    cap: 2500,
    capNote: "Max Rs 2,500 per year",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Use the exact amount from your salary slip or Form 16. Not all states levy professional tax.",
  },
  {
    id: "childrenEducationAllowance",
    enabled: true,
    section: "10(14)",
    label: "Children's Education & Hostel Allowance",
    description:
      "Exemption on employer-paid education or hostel allowance for up to 2 children.",
    cap: 288000,
    capNote: "Rs 3,000/month education + Rs 9,000/month hostel (max 2 children)",
    regimes: ["old"],
    group: "advanced",
    inputType: "amount",
    eligibility:
      "Only claimable if your employer pays a specific education or hostel allowance component in salary.",
  },
];

export const ENABLED_DEDUCTIONS = DEDUCTIONS_CONFIG.filter((d) => d.enabled);
export const BASIC_DEDUCTIONS = ENABLED_DEDUCTIONS.filter((d) => d.group === "basic");
export const ADVANCED_DEDUCTIONS = ENABLED_DEDUCTIONS.filter((d) => d.group === "advanced");
export const NEW_REGIME_DEDUCTIONS = ENABLED_DEDUCTIONS.filter((d) => d.regimes.includes("new"));

export function getDeductionConfig(id) {
  return DEDUCTIONS_CONFIG.find((d) => d.id === id) || null;
}

export function getEffectiveCap(id, options = {}, legacyParentsAreSenior = false) {
  const normalized =
    typeof options === "object" && options !== null
      ? options
      : { isSenior: Boolean(options), parentsAreSenior: legacyParentsAreSenior };

  const {
    isSenior = false,
    parentsAreSenior = false,
    basicSalary = 0,
    da = 0,
    employerType = "private",
  } = normalized;

  const config = getDeductionConfig(id);
  if (!config) return null;

  if (id === "section80D_self") return isSenior ? 50000 : 25000;
  if (id === "section80D_parents") return parentsAreSenior ? 50000 : 25000;
  if (id === "section80DDB") return isSenior ? 100000 : 40000;
  if (id === "section80CCD2") {
    const base = Math.max(0, Number(basicSalary || 0)) + Math.max(0, Number(da || 0));
    const rate = employerType === "central_govt" ? 0.14 : 0.1;
    return Math.round(base * rate);
  }

  return config.cap;
}
