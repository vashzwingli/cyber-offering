import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "赛博供奉｜现代诉求与传统神职路由",
  description: "从现代生活行为出发，在传统神职数据库中寻找可追溯的对应关系与安全供奉建议。",
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
