/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permissive headers — страница встраивается в Gemini canvas через iframe.
  // Снимаем все ограничения, которые могут помешать embed.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Разрешаем embed с любого origin (override любых дефолтов)
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
          // Открытый CORS (для сторонних fetch на стороне страницы)
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
          // Разрешаем clipboard API в iframe
          { key: 'Permissions-Policy', value: 'clipboard-read=*, clipboard-write=*' },
        ],
      },
    ];
  },
};

export default nextConfig;
