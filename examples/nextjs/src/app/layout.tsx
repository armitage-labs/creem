import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creem + Better-Auth Example",
  description: "Minimal Next.js example for the @creem_io/better-auth plugin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          maxWidth: 600,
          margin: "40px auto",
          padding: "0 20px",
          lineHeight: 1.6,
        }}
      >
        {children}
      </body>
    </html>
  );
}
