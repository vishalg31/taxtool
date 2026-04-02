# Tax Finder

Income Tax Calculator for India, built for FY 2025-26 comparison between the old and new regimes.

## What It Does

- compares old vs new tax regime
- supports salary, HRA, and deductions input
- includes advanced deductions with guidance
- exports PDF and CSV reports
- highlights the better regime and final tax after cess

## Deployment

- intended production subdomain: `tax.vishalbuilds.com`
- deploy via Vercel from this codebase

## Notes

- `vishal-lab` is the validation environment
- this `taxtool` folder is the production-ready code copy
- keep `.env.local`, build artifacts, and `node_modules` out of Git

## Main Files

- `app/`
- `components/TaxCalculator.jsx`
- `lib/tax/`

## Branding

- product name: `Tax Finder`
- parent site: `Vishal Builds`
