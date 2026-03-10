import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "Inspiraaation!",
  description: "Visual inspiration board from the best design resources",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} bg-black text-white antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
