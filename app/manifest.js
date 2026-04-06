export default function manifest() {
  return {
    name: "Tax Finder",
    short_name: "Tax Finder",
    description:
      "Free Indian income tax calculator for FY 2026-27 with old vs new regime comparison.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#fbbf24",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
