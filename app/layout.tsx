import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "赛博供奉｜所求何事",
  description: "写下心中所求，寻得相应神明，循礼供奉，收下一份寄语。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
