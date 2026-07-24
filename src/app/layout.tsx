import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteNavigation } from "@/components/navigation/site-navigation";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ChalkPilot",
    template: "%s · ChalkPilot",
  },
  description:
    "A room-aware learning agent for voice, physical boards, and external displays.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteNavigation />
        {children}
      </body>
    </html>
  );
}
