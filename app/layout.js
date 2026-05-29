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
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('frh-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark');}})();` }} />
        <IntroScreen />
        <Nav />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
