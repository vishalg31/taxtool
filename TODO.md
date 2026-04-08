## Tech Debt Note: Unify Tax Engines In Tax Finder

Current situation:
Tax Finder currently has two separate tax-calculation implementations.

1. UI inlined engine
- File: `components/TaxCalculator.jsx`
- Contains:
  - `TAX_RULES`
  - `calculateSlabTax`
  - `calculateHRA`
  - `calculateTaxEngine`
- This is the engine currently used by the live calculator UI when the user clicks `Calculate`

2. Shared modular engine
- File: `lib/tax/tax_engine.js`
- Intended as the reusable/shared source of truth for tax logic

Why this matters:
Both engines were updated for recent rule changes, including:
- FY `2026-27` updates
- HRA metro-city expansion
- allowance cap updates
- NRI support

However, they are still not fully identical internally.

Known inconsistency:
- In the inlined UI engine inside `components/TaxCalculator.jsx`, deduction breakdown now stores user-friendly deduction labels
  - this was done to fix UI rows like `80TTA` showing correctly
- In the shared engine inside `lib/tax/tax_engine.js`, deduction breakdown still stores raw IDs / internal keys

This means:
- current UI works correctly because it uses the inlined engine
- but if the app later switches to the shared engine/API output, the deduction display could differ or regress

NRI-related behavior currently implemented:
Both engines were updated to support:
- `Resident | NRI` status
- NRI uses below-60 slabs in old regime regardless of age
- no `87A` rebate for NRI in this tool
- `80TTA` allowed for NRI
- `80TTB` excluded for NRI
- surcharge, cess, HRA, and remaining deduction logic unchanged

Current decision:
Do not block the current release on this.
The app is safe to ship because the tested user-facing path uses the inlined engine in `components/TaxCalculator.jsx`.

Recommended future fix:
Create one single source of truth for tax logic.

Preferred direction:
- move UI to rely on `lib/tax/tax_engine.js`
- remove or minimize duplicated calculation logic inside `components/TaxCalculator.jsx`

Suggested cleanup tasks:
1. Compare `calculateTaxEngine` in `components/TaxCalculator.jsx` vs `lib/tax/tax_engine.js`
2. Align deduction breakdown structure between both
3. Decide whether display labels should be produced:
   - in engine output
   - or in UI mapping only
4. Ensure NRI logic is identical in both places
5. Switch the UI to one engine path only
6. Re-test:
   - resident vs NRI
   - old vs new regime
   - deductions visibility
   - exports
   - surcharge / cess / rebate behavior

Safe checkpoint:
The current lab version is the safe checkpoint before this refactor.
If anything breaks later, revert to the current working NRI-enabled version first, then do the engine unification separately.
