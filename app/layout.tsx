import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const title = "轻衡｜全家都能用的体重日记";
  const description =
    "记录早晚体重、每餐热量与生活状态，用温和清晰的趋势陪伴全家健康生活。";

  return {
    metadataBase: base,
    title,
    description,
    applicationName: "轻衡",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: base,
      title,
      description,
      siteName: "轻衡",
      images: [{ url: new URL("/og.png", base), width: 1200, height: 630, alt: "轻衡家庭体重日记" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [new URL("/og.png", base)],
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef6ef",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
