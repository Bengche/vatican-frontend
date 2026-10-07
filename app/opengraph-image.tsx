import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brand } from "@/config/brand";

export const alt = `${brand.name} | ${brand.seo.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public", "logo-mark.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: brand.colors.primary,
          padding: "72px 80px",
          color: "#ffffff",
          borderBottom: `14px solid ${brand.colors.accent}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={110} height={110} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: -1 }}>{brand.name}</div>
            <div style={{ fontSize: 26, color: brand.colors.accent, letterSpacing: 4, textTransform: "uppercase" }}>
              {brand.descriptor}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>
            {brand.hero.title}
          </div>
          <div style={{ fontSize: 30, color: "#cbd5e1", maxWidth: 900 }}>
            Choose your seat. Pay with Mobile Money. Travel with a verified e-ticket.
          </div>
        </div>
      </div>
    ),
    size,
  );
}