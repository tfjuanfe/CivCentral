import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import Header from "@/components/Header";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import SuspendedBanner from "@/components/SuspendedBanner";
import CardSpotlight from "@/components/CardSpotlight";
import { getCurrentUser } from "@/lib/auth";

// UI text in a clean grotesk; display headings in Fraunces, a high-contrast
// "old-style" serif that gives the archive an editorial, literary feel.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CivCentral | Minecraft civilization events",
  description:
    "The home for Minecraft civilization events: find the ones worth your time, see honest ratings, and trust the info. When an event ends, its story stays — the wars, nations, and characters that made it.",
};

// Set the theme before first paint to avoid a flash of the wrong mode.
const themeScript = `(function(){try{document.documentElement.classList.add('js');var t=localStorage.getItem('civcentral-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <CardSpotlight />
        <Header user={user} />
        {user?.suspended && (
          <SuspendedBanner
            status={user.status}
            until={user.suspendedUntil ? user.suspendedUntil.toISOString() : null}
          />
        )}
        {/* A suspended member can't contribute anyway, so don't also nag them
            to verify an email they can't yet use. */}
        {user && !user.suspended && !user.emailVerified && (
          <VerifyEmailBanner hasEmail={!!user.email} />
        )}
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <div className="footer-inner">
            <Image
              src="/icon.png"
              alt=""
              width={34}
              height={34}
              className="footer-mark"
            />
            <p>
              <strong>CivCentral</strong> is the home for Minecraft civilization
              events: find what&apos;s worth your time, see honest ratings, and keep
              the stories that follow.
            </p>
            <nav className="footer-links">
              <Link href="/info">About</Link>
              <Link href="/faq">FAQ</Link>
              <Link href="/legal/terms">Terms of Use</Link>
              <Link href="/legal/privacy">Privacy Policy</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
