import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import UsernameBar from "@/app/components/UsernameBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fragrantica Lookup",
  description: "Look up fragrances, save a collection, get recommendations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <UsernameBar />
        {children}
      </body>
    </html>
  );
}
