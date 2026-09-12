import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CityPin — LA 311 Assistant',
    short_name: 'CityPin',
    description:
      'Report city issues to Los Angeles 311 by voice or photo.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f8fb',
    theme_color: '#2a4b94',
    icons: [
      {
        src: '/app-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
