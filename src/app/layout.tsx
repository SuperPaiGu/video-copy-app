import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "视频文案生成",
  description: "上传视频，自动生成抖音标题和文案变体。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
