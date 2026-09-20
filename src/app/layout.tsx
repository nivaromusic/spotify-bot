import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Music Archive Bot | ربات موزیک تلگرام",
  description: "ربات تلگرام دانلود موزیک از اسپوتیفای با آرشیو خودکار و Cloudflare KV",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-gray-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
