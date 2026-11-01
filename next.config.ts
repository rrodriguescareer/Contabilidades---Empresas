import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  // Os documentos chegam em lotes de várias fotografias de telemóvel.
  experimental: {
    useTypeScriptCli: false,
    // Os ficheiros já vão diretamente para o Storage; pelo servidor só passa o
    // logótipo, que nunca chega perto disto.
    serverActions: { bodySizeLimit: '6mb' },
    // Uma página já aberta é reutilizada durante 30 segundos ao voltar a ela.
    staleTimes: { dynamic: 30, static: 300 },
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
      ],
    }, {
      // As imagens de /public ficam uma semana no browser (antes eram pedidas de novo em cada página).
      source: '/:ficheiro*(svg|png|webp|jpg|jpeg|ico)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
    }];
  },
};
export default config;
