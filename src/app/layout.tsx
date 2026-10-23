import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Open_Sans, Source_Sans_3 } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const body = Open_Sans({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--font-body" });
const display = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Proative 2.0",
  description: "Portal de governança da Proative",
  robots: { index: false, follow: false },
};

export type Theme = "light" | "dark" | "system";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = ((await cookies()).get("theme")?.value ?? "system") as Theme;
  return (
    <html lang="pt-BR" data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <body className={`${body.variable} ${display.variable} antialiased`}>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
