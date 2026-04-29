import { z } from "zod";

const DeductionsSchema = z.object({
  section80C: z.coerce.number().nonnegative().max(150000).default(0),
  section80CCC: z.coerce.number().nonnegative().max(150000).default(0),
  section80CCD1: z.coerce.number().nonnegative().max(150000).default(0),
  section80CCD1B: z.coerce.number().nonnegative().max(50000).default(0),
  section80CCD2: z.coerce.number().nonnegative().default(0),
  employerType: z.enum(["private", "central_govt"]).default("private"),
  section80D_self: z.coerce.number().nonnegative().max(50000).default(0),
  section80D_parents: z.coerce.number().nonnegative().max(50000).default(0),
  selfIsSenior: z.boolean().default(false),
  parentsAreSenior: z.boolean().default(false),
  homeLoanInterest: z.coerce.number().nonnegative().max(200000).default(0),
  section80E: z.coerce.number().nonnegative().default(0),
  section80EE: z.coerce.number().nonnegative().max(50000).default(0),
  section80EEA: z.coerce.number().nonnegative().max(150000).default(0),
  section80G: z.coerce.number().nonnegative().default(0),
  section80GG: z.coerce.number().nonnegative().max(60000).default(0),
  section80TTA: z.coerce.number().nonnegative().max(10000).default(0),
  section80TTB: z.coerce.number().nonnegative().max(50000).default(0),
  section80DD: z.coerce.number().nonnegative().max(125000).default(0),
  section80DDB: z.coerce.number().nonnegative().max(100000).default(0),
  section80U: z.coerce.number().nonnegative().max(125000).default(0),
  isSenior: z.boolean().default(false),
  professionalTax: z.coerce.number().nonnegative().max(2500).default(0),
  childrenEducationAllowance: z.coerce.number().nonnegative().max(9600).default(0),
  lta: z.coerce.number().nonnegative().default(0),
});

const TaxInputSchema = z
  .object({
    regime: z.enum(["old", "new"]),
    grossSalary: z.coerce.number().positive().max(100_000_000),
    age: z.coerce.number().int().min(18).max(100).default(30),
    basicSalary: z.coerce.number().nonnegative().default(0),
    da: z.coerce.number().nonnegative().default(0),
    hraReceived: z.coerce.number().nonnegative().default(0),
    rentPaid: z.coerce.number().nonnegative().default(0),
    city: z.string().trim().toLowerCase().default(""),
    deductions: DeductionsSchema.optional().default({}),
  })
  .superRefine((data, ctx) => {
    if (data.regime === "old" && data.hraReceived > 0 && data.basicSalary === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["basicSalary"],
        message: "basicSalary is required when hraReceived > 0",
      });
    }
    if (data.basicSalary > data.grossSalary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["basicSalary"],
        message: "basicSalary cannot exceed grossSalary",
      });
    }
  });

const TaxCompareInputSchema = z.object({
  grossSalary: z.coerce.number().positive().max(100_000_000),
  age: z.coerce.number().int().min(18).max(100).default(30),
  basicSalary: z.coerce.number().nonnegative().default(0),
  da: z.coerce.number().nonnegative().default(0),
  hraReceived: z.coerce.number().nonnegative().default(0),
  rentPaid: z.coerce.number().nonnegative().default(0),
  city: z.string().trim().toLowerCase().default(""),
  deductions: DeductionsSchema.optional().default({}),
});

export { TaxInputSchema, TaxCompareInputSchema, DeductionsSchema };
