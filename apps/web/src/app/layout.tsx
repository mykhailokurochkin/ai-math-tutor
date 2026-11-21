import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Math Tutor — Neuro-Symbolic USSR Math Education",
  description: "Interactive AI mathematics tutor with deterministic symbolic verification and Socratic guidance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
