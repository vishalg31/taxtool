/**
 * API Route: POST /api/tax/calculate
 * Next.js App Router | Edge-safe | Server-side only
 *
 * ─── GEMINI INSTRUCTIONS ────────────────────────────────────────────────────
 * 1. Do NOT import this route or any tax engine file into client components.
 * 2. Do NOT modify tax_engine.js or tax_rules_fy2025_26.json.
 * 3. The engine is pure — no DB calls, no async, no side effects.
 * 4. For regime comparison, the CLIENT calls this endpoint TWICE in parallel
 *    (once per regime) — do NOT build a /compare endpoint.
 * 5. All monetary values are in whole INR (rupees). No floats in responses.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Request body: See TaxInputSchema in lib/tax/schema.js
 * Response:     See "Success Response Shape" below
 */

import { TaxInputSchema } from "@/lib/tax/schema";
import { calculateTax } from "@/lib/tax/tax_engine";

// ─────────────────────────────────────────────
// RATE LIMITING (plug in your preferred lib)
// ─────────────────────────────────────────────
// TODO (Gemini): Add rate limiting here.
// Recommended: `import { Ratelimit } from "@upstash/ratelimit"`
// or a simple in-memory limiter for MVP.
// Key by IP: request.headers.get("x-forwarded-for")

// ─────────────────────────────────────────────
// ALLOWED ORIGINS (CORS)
// ─────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─────────────────────────────────────────────
// OPTIONS — preflight
// ─────────────────────────────────────────────
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ─────────────────────────────────────────────
// POST — main handler
// ─────────────────────────────────────────────
export async function POST(request) {
  // ── 1. Parse raw body ───────────────────────
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  // ── 2. Validate with Zod ────────────────────
  const parsed = TaxInputSchema.safeParse(rawBody);

  if (!parsed.success) {
    // flatten() gives { fieldErrors: {}, formErrors: [] }
    // — easy to map directly to form field errors on the client
    return errorResponse(400, "VALIDATION_ERROR", "Invalid input", {
      fieldErrors: parsed.error.flatten().fieldErrors,
      formErrors:  parsed.error.flatten().formErrors,
    });
  }

  const input = parsed.data;

  // ── 3. Warn if new regime input includes ignored fields ─
  const warnings = [];
  if (input.regime === "new") {
    const hasDeductions =
      input.deductions &&
      Object.values(input.deductions).some((v) => typeof v === "number" && v > 0);
    if (hasDeductions) {
      warnings.push(
        "Deductions (80C, 80D, etc.) are not applicable in the new regime and have been ignored."
      );
    }
    if (input.hraReceived > 0) {
      warnings.push(
        "HRA exemption is not applicable in the new regime and has been ignored."
      );
    }
  }

  // ── 4. Run the tax engine ───────────────────
  // The engine is pure sync JS — no try/catch needed for async,
  // but wrap for unexpected runtime errors.
  let result;
  try {
    result = calculateTax(input);
  } catch (err) {
    console.error("[tax/calculate] Engine error:", err);
    return errorResponse(500, "ENGINE_ERROR", "Tax calculation failed. Please try again.");
  }

  // ── 5. Shape the success response ──────────────
  const summary = {
    ...result.summary,
    monthlyTax: Math.floor(result.finalTax / 12),
  };

  return successResponse({
    fy: result.fy,
    regime: result.regime,
    warnings,
    summary,
    steps: result.steps, // send full breakdown; UI decides what to show
  });
}

// ─────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────

function successResponse(data) {
  return Response.json(
    { success: true, ...data },
    { status: 200, headers: corsHeaders }
  );
}

function errorResponse(status, code, message, details = undefined) {
  return Response.json(
    { success: false, error: { code, message, ...(details && { details }) } },
    { status, headers: corsHeaders }
  );
}