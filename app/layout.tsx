import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://travelmarkets.ca";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Travel Markets | Student Housing & Travel Rentals",
    template: "%s | Travel Markets",
  },
  description:
    "Travel Markets helps students and travelers find trusted rentals, student housing, viewing appointments, secure messaging, and verified owners.",
  keywords: [
    "Travel Markets",
    "student housing",
    "student rentals",
    "campus housing",
    "Oshawa rentals",
    "Toronto rentals",
    "Canada student housing",
    "short term rentals",
  ],
  openGraph: {
    title: "Travel Markets",
    description:
      "Find trusted student housing, travel rentals, verified owners, and secure viewing appointments.",
    url: siteUrl,
    siteName: "Travel Markets",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Travel Markets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Travel Markets",
    description:
      "Find trusted student housing, travel rentals, verified owners, and secure viewing appointments.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Analytics />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}