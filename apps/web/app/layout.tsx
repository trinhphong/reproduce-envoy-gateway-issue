import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Envoy streaming chat",
  description: "Compare a streamed tRPC chat directly and through Envoy.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
