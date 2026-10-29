import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  // Os documentos chegam em lotes de várias fotografias de telemóvel.
  experimental: { useTypeScriptCli: false, serverActions: { bodySizeLimit: '40mb' } },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    }];
  },
};
export default config;
