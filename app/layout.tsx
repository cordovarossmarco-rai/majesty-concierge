import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Geist } from "next/font/google";
import "./globals.css";

/*
  Cormorant is a high contrast old style face. The thin hairlines read as calm rather than
  corporate, which is the register a spa wants, and it stays out of the way at body sizes
  because it is only used for headings.
*/
const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Majesty Day Spa",
  description: "Tell us what you are looking for and we will find the right treatment for you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
