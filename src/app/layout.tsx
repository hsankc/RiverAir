import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "./providers";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-plex-condensed",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RiverAir — drone missions, paid in lira",
  description:
    "A marketplace for autonomous drone work in Turkey. Customers pay in Turkish lira, operators are paid in lira, and the money in between is held by a Stellar escrow contract that will not settle against a stale price.",
  keywords: [
    "drone",
    "Stellar",
    "Soroban",
    "anchor",
    "SEP-6",
    "TRY",
    "USDC",
    "autonomous flight",
    "RiverAir",
  ],
  icons: {
    icon: "/riverair-mark.png",
    apple: "/riverair-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables go on <html>, not <body>. `globals.css` declares
    // `--font-condensed: var(--font-plex-condensed), …` on :root, and a custom
    // property is resolved on the element that declares it — so with the Plex
    // variables one level lower the whole chain computed to nothing and every
    // heading in the app silently fell back to system sans.
    <html
      lang="en"
      className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable}`}
    >
      <body className="font-sans antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
