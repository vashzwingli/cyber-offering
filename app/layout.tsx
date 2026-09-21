import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "赛博供奉｜所求何事",
  description: "说出所求，在传统神职数据库中寻找对应，循清净供奉次序完成一场克制、可追溯的数字仪式。",
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
