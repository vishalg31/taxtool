import TaxCalculator from "@/components/TaxCalculator";

export default function Page() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Tax Finder",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: "https://tax.vishalbuilds.com/",
    description:
      "Free Indian income tax calculator for FY 2026-27. Compare old vs new regime, estimate tax, cess, surcharge, HRA, deductions, and monthly TDS.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    creator: {
      "@type": "Person",
      name: "Vishal",
      url: "https://www.vishalbuilds.com/",
    },
    publisher: {
      "@type": "Organization",
      name: "Vishal Builds",
      url: "https://www.vishalbuilds.com/",
    },
    featureList: [
      "Old vs New regime comparison",
      "Income tax calculation for FY 2026-27",
      "HRA and deduction support",
      "Surcharge and cess calculation",
      "PDF and CSV export",
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <TaxCalculator />
    </main>
  );
}
