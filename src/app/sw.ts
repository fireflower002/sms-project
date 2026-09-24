import type { PrecacheEntry } from 'serwist'
import { Serwist, NetworkOnly, StaleWhileRevalidate } from 'serwist'

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | PrecacheEntry)[] | undefined
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Allowlist ONLY: /_next/static/*, /icons/*, and fonts
    {
      matcher: ({ request, url }) => {
        const isNextStatic = url.pathname.startsWith('/_next/static/')
        const isIcons = url.pathname.startsWith('/icons/')
        const isFont =
          request.destination === 'font' ||
          /\.(?:woff|woff2|ttf|otf|eot)$/i.test(url.pathname)

        return isNextStatic || isIcons || isFont
      },
      handler: new StaleWhileRevalidate({
        cacheName: 'static-allowlist-v1',
      }),
    },
    // 2. Everything else MUST be NetworkOnly (includes RSC requests, navigations, APIs, dynamic data)
    {
      matcher: () => true,
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()
