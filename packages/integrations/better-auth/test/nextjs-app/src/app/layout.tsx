import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creem Better-Auth Test App",
  description: "Testing Creem integration with Better-Auth",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">{children}</body>
    </html>
  );
}
