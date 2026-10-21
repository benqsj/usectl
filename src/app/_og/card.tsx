// The link-preview card (Open Graph / Twitter image) — the picture Telegram, Messenger, X,
// Slack, LinkedIn, Discord… show when someone pastes a usectl.com link.
//
// Rendered at build time by next/og (Satori → PNG), so it is a static 1200×630 file in the
// end. Satori supports only a subset of CSS: flexbox layout, every element with more than one
// child needs `display: flex`, no grid, no CSS variables — hence the plain inline styles.
// The artwork is the page's own assets (logo, hero hatch, the exploded server), read from
// public/ and inlined as data URLs.
//
// `_og` is a private folder (leading underscore), so nothing here becomes a route.
/* eslint-disable @next/next/no-img-element -- Satori (next/og) only understands plain <img> */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

const BG = "#1e1d1d";
const BRAND = "#11a32a";

// The page's grid, at the card's scale (1200 / 1920 = 0.625 of the 82 × 114 design pitch).
const PITCH_X = 82 * 0.625;
const PITCH_Y = 114 * 0.625;
const INSET = 62; // ≈ the page's 99px content inset at 1920

async function svgDataUrl(rel: string) {
  const svg = await readFile(join(process.cwd(), "public", rel));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

export async function renderShareCard() {
  const [medium, light, logo, hatch, server] = await Promise.all([
    readFile(join(process.cwd(), "src/app/_og/SpaceGrotesk-Medium.woff")),
    readFile(join(process.cwd(), "src/app/_og/SpaceGrotesk-Light.woff")),
    svgDataUrl("logo/logo.svg"),
    svgDataUrl("section-hero/hatch.svg"),
    svgDataUrl("section-hero/new-server.svg"),
  ]);

  const cols = Math.ceil((OG_SIZE.width - INSET) / PITCH_X);
  const rows = Math.ceil(OG_SIZE.height / PITCH_Y);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BG,
          fontFamily: "Space Grotesk",
          color: "#ededed",
          overflow: "hidden",
        }}
      >
        {/* background grid — same faint hairlines as the page */}
        {Array.from({ length: cols }, (_, i) => (
          <div
            key={`c${i}`}
            style={{
              position: "absolute",
              left: INSET + i * PITCH_X,
              top: 0,
              width: 1,
              height: OG_SIZE.height,
              background: "rgba(255,255,255,0.045)",
            }}
          />
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={`r${i}`}
            style={{
              position: "absolute",
              left: 0,
              top: 40 + i * PITCH_Y,
              width: OG_SIZE.width,
              height: 1,
              background: "rgba(255,255,255,0.035)",
            }}
          />
        ))}

        {/* scene light behind the server — the page's mint → blue glow */}
        <div
          style={{
            position: "absolute",
            left: 560,
            top: -120,
            width: 900,
            height: 900,
            background:
              "radial-gradient(circle at 50% 50%, rgba(17,163,42,0.26) 0%, rgba(90,255,200,0.08) 22%, rgba(143,198,255,0.03) 34%, rgba(30,29,29,0) 46%)",
          }}
        />

        {/* the exploded server (421 × 687 native) */}
        <img
          src={server}
          width={330}
          height={538}
          alt=""
          style={{ position: "absolute", left: 818, top: 52 }}
        />

        {/* left column */}
        <div
          style={{
            position: "absolute",
            left: INSET + 30,
            top: 80,
            width: 730,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <img src={logo} width={181} height={30} alt="" />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 100,
              fontSize: 21,
              fontWeight: 300,
              color: "rgba(255,255,255,0.62)",
            }}
          >
            <img src={hatch} width={40} height={18} alt="" style={{ marginRight: 12 }} />
            Managed Kubernetes &amp; AI Agent Infrastructure
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 57,
              fontWeight: 500,
              lineHeight: 1.16,
              letterSpacing: "-0.02em",
            }}
          >
            Build your product. We&rsquo;ll handle the infrastructure.
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 23,
              fontWeight: 300,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.62)",
              maxWidth: 620,
            }}
          >
            Apps, databases, workers and AI agents — from code to production, without a DevOps
            team.
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 48,
                padding: "0 26px",
                borderRadius: 9999,
                border: `1.5px solid ${BRAND}`,
                color: "#5fe07a",
                fontSize: 20,
                fontWeight: 500,
              }}
            >
              From $15 / month
            </div>
            <div
              style={{
                display: "flex",
                marginLeft: 22,
                fontSize: 20,
                fontWeight: 300,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              usectl.com
            </div>
          </div>
        </div>

      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Space Grotesk", data: medium, weight: 500, style: "normal" },
        { name: "Space Grotesk", data: light, weight: 300, style: "normal" },
      ],
    },
  );
}
