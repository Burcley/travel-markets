import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
  title: {
    default: "Travel Markets",
    template: "%s | Travel Markets",
  },
  description:
    "Find student housing, travel stays, and trusted owner listings with secure address protection.",
  keywords: [
    "Travel Markets",
    "student housing",
    "campus housing",
    "student rentals",
    "Oshawa housing",
    "Toronto housing",
    "marketplace",
  ],
  openGraph: {
    title: "Travel Markets",
    description:
      "A safer marketplace for student housing, travel stays, and trusted owner connections.",
    url: "https://travelmarkets.ca",
    siteName: "Travel Markets",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Travel Markets",
    description:
      "Find student housing and trusted marketplace listings with protected addresses.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-black text-white antialiased`}
      >
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}