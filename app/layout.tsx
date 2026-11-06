import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SlotForge — Make room for great work",
  description:
    "Thoughtful spaces. Effortless bookings. Find a little room for your next big idea.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
