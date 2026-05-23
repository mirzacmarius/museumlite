import { Cormorant_Garamond, Inter } from "next/font/google";

export const marketingDisplayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-marketing-display",
});

export const marketingSansFont = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-marketing-sans",
});

export const marketingFontClassName = `${marketingDisplayFont.variable} ${marketingSansFont.variable}`;
