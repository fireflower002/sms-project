import { NextResponse } from 'next/server'

/**
 * NOTE ON MULTI-INSTANCE / SERVERLESS DEPLOYMENTS:
 * In-memory rate limiting is process-local and is not guaranteed to be shared across
 * multiple serverless lambdas or multi-node clusters in horizontally scaled environments.
 * For our current single-instance deployment scale (~4 users), this in-memory approach
 * is appropriate and zero-dependency, but for multi-region serverless clusters a distributed
 * store like Redis / Upstash would be required.
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-process sliding window memory store
const rateLimitStore = new Map<string, RateLimitRecord>()

// Periodically clean up expired entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    rateLimitStore.forEach((record, key) => {
      if (now > record.resetTime) {
        rateLimitStore.delete(key)
      }
    })
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  /** Time window in milliseconds (e.g. 60,000 = 1 min) */
  windowMs: number
  /** Maximum number of allowed requests per window */
  maxRequests: number
}

/**
 * Helper to extract Client IP safely without silently bundling all clients into one bucket.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim()
    if (firstIp) return firstIp
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp && realIp.trim()) return realIp.trim()
  
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp && cfIp.trim()) return cfIp.trim()

  // Fallback: If headers are absent (e.g., local dev socket), incorporate user-agent & accept-language
  // fingerprints so different un-proxied clients do NOT share a single global bucket.
  const ua = req.headers.get('user-agent') || 'no-ua'
  const lang = req.headers.get('accept-language') || 'no-lang'
  return `direct-connection:${simpleHash(ua + '|' + lang)}`
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

/**
 * Check rate limit for a specific identifier (user ID or client IP) on an endpoint.
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now()
  const key = `${endpoint}:${identifier}`
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return { allowed: true, remaining: config.maxRequests - 1, resetInMs: config.windowMs }
  }

  if (record.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: Math.max(0, record.resetTime - now),
    }
  }

  record.count += 1
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetInMs: Math.max(0, record.resetTime - now),
  }
}

/**
 * Returns a standardized 429 Too Many Requests response with Retry-After header.
 */
export function rateLimitResponse(resetInMs: number) {
  const retryAfterSeconds = Math.ceil(resetInMs / 1000)
  return NextResponse.json(
    {
      error: `Too many requests. Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} before trying again.`,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  )
}
