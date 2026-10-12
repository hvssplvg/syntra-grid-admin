import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/* ============================================================================
   FONTS
============================================================================ */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/* ============================================================================
   METADATA — SYNTRA GRID ADMIN
============================================================================ */

export const metadata: Metadata = {
  metadataBase: new URL("https://admin.syntragrid.com"),

  title: {
    default: "Syntra Grid | Admin Dashboard",
    template: "%s | Syntra Grid",
  },

  description:
    "Syntra Grid's secure administration platform for managing clients, projects, operations, employees, finances, and business growth.",

  applicationName: "Syntra Grid Admin",

  robots: {
    index: false,
    follow: false,
  },

  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/icon.png",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },

  openGraph: {
    type: "website",
    siteName: "Syntra Grid",
    title: "Syntra Grid | Admin Dashboard",
    description:
      "The secure administration platform for Syntra Grid.",
    url: "https://admin.syntragrid.com",
  },
};

/* ============================================================================
   ROOT LAYOUT
============================================================================ */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    > 
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}