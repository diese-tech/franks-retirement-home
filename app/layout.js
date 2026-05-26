import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import IntroScreen from '@/app/components/IntroScreen';

export const metadata = {
  title: "Frank's Retirement Home",
  description: "Frank's Retirement Home — Smite 2 draft league",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('frh-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark');}})();` }} />
      </head>
      <body>
        <IntroScreen />
        <Nav />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
