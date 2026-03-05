import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inspiraaation!",
  description: "Visual inspiration board from the best design resources",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
