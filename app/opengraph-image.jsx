import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tax Finder - Income Tax Calculator FY 2026-27";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: "rgba(251, 191, 36, 0.18)",
            filter: "blur(8px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -140,
            left: -100,
            width: 320,
            height: 320,
            borderRadius: 9999,
            background: "rgba(56, 189, 248, 0.12)",
            filter: "blur(8px)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "56px 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#fbbf24",
                  color: "#0f172a",
                  fontSize: 38,
                  fontWeight: 900,
                }}
              >
                V
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 30, fontWeight: 800 }}>Vishal Builds</div>
                <div style={{ fontSize: 18, color: "#94a3b8" }}>Finance tool for Indian salaried users</div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: 9999,
                border: "1px solid rgba(251, 191, 36, 0.35)",
                background: "rgba(251, 191, 36, 0.10)",
                color: "#fbbf24",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              FY 2026-27
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 860,
            }}
          >
            <div
              style={{
                fontSize: 76,
                lineHeight: 1.02,
                fontWeight: 900,
                letterSpacing: -2,
              }}
            >
              Tax Finder
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 34,
                lineHeight: 1.2,
                color: "#e2e8f0",
                fontWeight: 600,
              }}
            >
              Free Income Tax Calculator
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 28,
                lineHeight: 1.35,
                color: "#94a3b8",
                maxWidth: 980,
              }}
            >
              Compare Old vs New Regime, calculate surcharge and cess, check HRA and deductions, and estimate monthly TDS instantly.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}
          >
            {["Old vs New Regime", "HRA + Deductions", "PDF + CSV Export"].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  padding: "12px 18px",
                  borderRadius: 9999,
                  background: "rgba(15, 23, 42, 0.72)",
                  border: "1px solid rgba(148, 163, 184, 0.20)",
                  color: "#cbd5e1",
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
