import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Empresas · RR.',
    short_name: 'RR. Empresas',
    description: 'Balancetes, saldos, documentos do mês e mensagens com o contabilista.',
    id: '/',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#0A2344',
    theme_color: '#0A2344',
    lang: 'pt-PT',
    categories: ['finance', 'business', 'productivity'],
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
