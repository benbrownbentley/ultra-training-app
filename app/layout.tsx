import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/app/_components/theme/ThemeProvider";
import { getAthleteProfile } from "@/lib/supabase/server";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: BRAND_TAGLINE,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the persisted theme so signed-in users see their preference
  // applied immediately — avoids the flash-of-system-theme on first paint.
  // Fails open to "system" for anonymous routes (sign-in/up) where the
  // profile lookup returns null.
  let initialTheme: "light" | "dark" | "system" = "system";
  try {
    const profile = await getAthleteProfile();
    initialTheme = (profile?.theme ?? "system") as
      | "light"
      | "dark"
      | "system";
  } catch {
    // No session yet — keep the default.
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme={initialTheme}
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
