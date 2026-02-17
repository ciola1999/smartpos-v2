import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { TauriProvider } from "@/components/providers/tauri-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart POS",
  description: "Point of Sale System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className={inter.className}>
        <QueryProvider>
          <TauriProvider>
            <NuqsAdapter>
              {children}
              <Toaster position="top-right" richColors closeButton />
            </NuqsAdapter>
          </TauriProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
