import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const siteUrl = "https://tax.vishalbuilds.com";
const siteTitle = "Tax Finder - Income Tax Calculator FY 2026-27";
const siteDescription =
  "Free Indian income tax calculator for FY 2026-27. Compare old vs new regime, calculate slab tax, surcharge, cess, HRA, deductions, and monthly TDS instantly.";
const socialImage = `${siteUrl}/opengraph-image`;

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || siteDescription,
  applicationName: "Tax Finder",
  keywords: [
    "income tax calculator india",
    "tax calculator FY 2026-27",
    "old vs new regime calculator",
    "salary tax calculator india",
    "hra tax calculator",
    "tds calculator india",
    "income tax calculator 2026",
    "tax finder",
  ],
  authors: [{ name: "Vishal" }],
  creator: "Vishal",
  publisher: "Vishal Builds",
  category: "finance",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Tax Finder",
    title: siteTitle,
    description: siteDescription,
    locale: "en_IN",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "Tax Finder preview card",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [socialImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
