import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.colors.primaryDark,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${brand.colors.accent}`,
          borderRadius: 9,
          color: brand.colors.accent,
          fontSize: brand.monogram.length > 2 ? 22 : 29,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        {brand.monogram}
      </div>
    </div>,
    size,
  );
}
