import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opulent // Sponsor Context Signal Room",
  description: "Evidence-safe Context.dev sponsor sourcing showcase",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
