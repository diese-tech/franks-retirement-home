import './globals.css';
import { Boogaloo, JetBrains_Mono, Share_Tech_Mono, VT323 } from 'next/font/google';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import IntroScreen from '@/app/components/IntroScreen';

const boogaloo     = Boogaloo({ subsets: ['latin'], weight: '400',          variable: '--font-boogaloo',      display: 'swap' });
const jetbrainsMono= JetBrains_Mono({ subsets: ['latin'], weight: ['400','500'], variable: '--font-jetbrains-mono', display: 'swap' });
const shareTechMono= Share_Tech_Mono({ subsets: ['latin'], weight: '400',   variable: '--font-share-tech-mono', display: 'swap' });
const vt323        = VT323({ subsets: ['latin'], weight: '400',              variable: '--font-vt323',         display: 'swap' });

export const metadata = {
  title: "Frank's Retirement Home",
  description: "Frank's Retirement Home — Smite 2 draft league",
};

export default function RootLayout({ children }) {
  const fontVars = [boogaloo.variable, jetbrainsMono.variable, shareTechMono.variable, vt323.variable].join(' ');
  return (
    <html lang="en" suppressHydrationWarning className={fontVars}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-frh-yellow focus:text-frh-ink focus:font-mono focus:text-sm focus:rounded"
        >
          Skip to main content
        </a>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('frh-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark');}})();` }} />
        <IntroScreen />
        <Nav />
        <main id="main-content" className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
