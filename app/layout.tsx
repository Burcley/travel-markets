import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import StructuredData from "@/components/StructuredData";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://travelmarkets.ca";

const siteDescription =
  "Find trusted student housing near campus across Canada. Browse verified rentals, message landlords securely, book viewings, and discover your next student home with Travel Markets.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Travel Markets | Canada's Trusted Student Housing Marketplace",
    template: "%s | Travel Markets",
  },
  description: siteDescription,
  keywords: [
    "Travel Markets",
    "student housing",
    "student rentals",
    "campus housing",
    "Oshawa rentals",
    "Toronto rentals",
    "Canada student housing",
    "campus rentals",
    "landlord student rentals",
  ],
  applicationName: "Travel Markets",
  authors: [{ name: "Travel Markets" }],
  creator: "Travel Markets",
  publisher: "Travel Markets",
  category: "real estate",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Travel Markets | Canada's Trusted Student Housing Marketplace",
    description: siteDescription,
    url: siteUrl,
    siteName: "Travel Markets",
    type: "website",
    locale: "en_CA",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Travel Markets student housing marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Travel Markets | Student Housing Marketplace",
    description: siteDescription,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-CA" className={inter.className}>
      <body className="min-h-screen bg-[#050505] text-white antialiased">
        <StructuredData />
        <Analytics />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}