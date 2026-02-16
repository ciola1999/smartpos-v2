import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart POS",
  description: "Point of Sale System",
};

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className={inter.className}>
        <NuqsAdapter>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </NuqsAdapter>
      </body>
    </html>
  );
}
