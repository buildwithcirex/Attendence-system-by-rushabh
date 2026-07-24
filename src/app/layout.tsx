import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Monospace is kept only for numeric displays (session timer, OTP) where
// tabular digits prevent width jitter. Gilroy is the primary UI font,
// self-hosted via @font-face in globals.css.
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "E-Cell Attendance",
  description: "E-Cell Attendance Recording System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} dark`}>
      <body className="antialiased bg-[#0a0a0a] text-[#f2f2f2] min-h-screen">
        {children}
      </body>
    </html>
  );
}
