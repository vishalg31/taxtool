import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "Tax Finder - Income Tax Calculator FY 2025-26",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "Compare old vs new tax regime for FY 2025-26",
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
