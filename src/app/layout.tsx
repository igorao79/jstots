import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JS → TS Converter",
  description: "AI-powered JavaScript to TypeScript converter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
