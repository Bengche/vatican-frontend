import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.colors.primaryDark,
      }}
    >
      <div
        style={{
          width: 148,
          height: 148,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `3px solid ${brand.colors.accent}`,
          borderRadius: 22,
          color: brand.colors.accent,
          fontSize: brand.monogram.length > 2 ? 58 : 76,
          fontWeight: 700,
          letterSpacing: 3,
        }}
      >
        {brand.monogram}
      </div>
    </div>,
    size,
  );
}
