/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] },
  // Redirigir dominio viejo al nuevo (evita problemas de cookies/sesión).
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'narvoq.vercel.app' }],
        destination: 'https://www.narvoq.com.ar/:path*',
        permanent: true
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'narvoq-git-main-narvoq.vercel.app' }],
        destination: 'https://www.narvoq.com.ar/:path*',
        permanent: true
      }
    ];
  }
};
export default nextConfig;
