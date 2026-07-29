import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Gilroy is the primary UI font (self-hosted from public/fonts). Only Light and
// ExtraBold weights are shipped; intermediate weights are browser-synthesized.
// Monospace is kept only for numeric displays (session timer, OTP) where tabular
// digits prevent width jitter.
const gilroy = localFont({
  src: [
    { path: "../../public/fonts/Gilroy-Light.otf", weight: "300", style: "normal" },
    { path: "../../public/fonts/Gilroy-ExtraBold.otf", weight: "800", style: "normal" },
  ],
  variable: "--font-gilroy",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://logs.kcecell.org"),
  title: "E-Cell Attendance",
  description: "E-Cell Attendance Recording System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${gilroy.variable} ${jetbrainsMono.variable} dark`}>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
      </body>
    </html>
  );
}
