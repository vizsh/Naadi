import type { Metadata, Viewport } from 'next';
import { Anek_Devanagari, Anek_Latin, Martian_Mono } from 'next/font/google';
import { Header } from '@/components/shell/Header';
import { TipLayer } from '@/components/shell/TipLayer';
import { Sprite } from '@/components/shell/Icons';
import { Persistence } from '@/components/shell/Offline';
import './globals.css';
import './surfaces.css';

const anek = Anek_Latin({ subsets: ['latin'], axes: ['wdth'], variable: '--font-anek', display: 'swap' });
const anekDeva = Anek_Devanagari({ subsets: ['devanagari', 'latin'], axes: ['wdth'], variable: '--font-anek-deva', display: 'swap' });
const martian = Martian_Mono({ subsets: ['latin'], axes: ['wdth'], variable: '--font-martian', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'NAADI · machine pulse intelligence', template: '%s · NAADI' },
  description:
    'NAADI turns a ₹1,500 sensor or a phone into a punched-card digital twin for powerlooms, flour mills and pump sets: physics-first diagnosis, time to failure, rupee decisions and owner-approved agents.',
  applicationName: 'NAADI',
};

export const viewport: Viewport = { themeColor: '#f3f4ef', colorScheme: 'light' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${anek.variable} ${anekDeva.variable} ${martian.variable}`}>
      <body>
        <Sprite />
        <Persistence />
        <a className="skip" href="#main">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <TipLayer />
      </body>
    </html>
  );
}
