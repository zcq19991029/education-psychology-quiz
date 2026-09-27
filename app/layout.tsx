import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qualification Quiz",
  description: "Offline friendly qualification quiz",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head><link rel="stylesheet" href="/styles.css?v=202609280001" /></head>
      <body>
        {children}
        <script type="module" src="/app.js?v=202609280001" />
      </body>
    </html>
  );
}
