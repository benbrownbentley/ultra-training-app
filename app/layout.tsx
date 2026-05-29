import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/app/_components/theme/ThemeProvider";
import {
  getAthleteProfile,
  getCurrentUserId,
} from "@/lib/supabase/server";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getBannerStateForUser } from "@/lib/regen-banner";
import { RegenStatusBanner } from "@/app/_components/regen/RegenStatusBanner";
import { RegenStatusProvider } from "@/app/_components/regen/RegenStatusProvider";
import { RegenProgressSheet } from "@/app/_components/regen/RegenProgressSheet";

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
  let userId: string | null = null;
  let initialBannerState = null;
  try {
    const [profile, currentUserId] = await Promise.all([
      getAthleteProfile(),
      getCurrentUserId(),
    ]);
    initialTheme = (profile?.theme ?? "system") as
      | "light"
      | "dark"
      | "system";
    userId = currentUserId;
    // Server-render the banner's initial state so the first paint
    // already shows the right thing — without this the client would
    // flash empty for one render before its Realtime subscription
    // returns a payload. Anonymous routes get a null userId and skip
    // the banner mount entirely (middleware redirects unauth users
    // away from non-auth pages, so this only no-ops on /sign-in etc.).
    if (currentUserId) {
      initialBannerState = await getBannerStateForUser(currentUserId);
    }
  } catch {
    // No session yet — keep the defaults.
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
          {/* Provider stays mounted on every route (including
              unauthenticated /sign-in etc.) so consumers that read
              `useRegenStatus()` from RegenerateSheet — mounted across
              Today / Plan / regen pages — always get a context.
              With no userId it skips the Realtime subscription and
              keeps the banner + sheet in idle (renders nothing). */}
          <RegenStatusProvider
            userId={userId}
            initialState={initialBannerState}
          >
            {userId && <RegenStatusBanner />}
            {userId && <RegenProgressSheet />}
            {children}
          </RegenStatusProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
