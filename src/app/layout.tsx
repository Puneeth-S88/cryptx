import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRYPTEX 2026 | The Ultimate Cryptography Championship",
  description: "Live, organizer-controlled cryptography competition platform. Crack. Decode. Conquer.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-surface-dark text-typography-white selection:bg-accent-blue selection:text-white flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
