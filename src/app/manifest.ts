import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'School Management System',
    short_name: 'SMS',
    description: 'Timetable, staff, inventory and communication for Sri Lankan schools',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FAFAFA',
    theme_color: '#18181B',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
