import type { Metadata, Viewport } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';

// As mesmas das outras plataformas: DM Sans no corpo, Manrope nos títulos.
const corpo = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--fonte-corpo', weight: ['400', '500', '600', '700', '800'] });
const titulos = Manrope({ subsets: ['latin'], display: 'swap', variable: '--fonte-titulos', weight: ['500', '600', '700', '800'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.rr-contabilidade.com'),
  title: { default: 'Empresas · RR.', template: '%s · RR.' },
  description: 'Portal dos clientes de contabilidade: balancetes, saldos, documentos do mês e mensagens com o contabilista.',
  applicationName: 'RR. Empresas',
  appleWebApp: { capable: true, title: 'RR. Empresas', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icone-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F3F7FD' },
    { media: '(prefers-color-scheme: dark)', color: '#0A2344' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${corpo.variable} ${titulos.variable}`}>
      <body>
        <a className="skip" href="#principal">Saltar para o conteúdo</a>
        {children}
      </body>
    </html>
  );
}
