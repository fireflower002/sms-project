export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL
  if (envUrl) {
    let url = envUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }
    return url.replace(/\/$/, '')
  }
  return 'https://sms-project-lac.vercel.app'
}

export function getItemPublicUrl(token: string): string {
  const siteUrl = getSiteUrl()
  return `${siteUrl}/item/${token}`
}
