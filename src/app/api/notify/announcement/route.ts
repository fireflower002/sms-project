import { NextResponse } from 'next/server'
import { z } from 'zod'
import sanitizeHtml from 'sanitize-html'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit'

const notifyAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must not exceed 200 characters'),
  body: z.string().max(5000, 'Body must not exceed 5000 characters').optional().default(''),
  priority: z.string().optional().default('normal'),
})

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request)
    const rateLimit = checkRateLimit(clientIp, '/api/notify/announcement', {
      windowMs: 60 * 1000,
      maxRequests: 5,
    })
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetInMs)
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized — login required' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden — admin role required' }, { status: 403 })
    }

    const jsonBody = await request.json().catch(() => ({}))
    const parseResult = notifyAnnouncementSchema.safeParse(jsonBody)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid announcement notification payload'
      return NextResponse.json({ success: false, error: firstError }, { status: 400 })
    }

    const { title, body, priority } = parseResult.data

    const cleanTitle = sanitizeHtml(title.trim(), { allowedTags: [], allowedAttributes: {} })
    const cleanBody = sanitizeHtml(body.trim(), { allowedTags: [], allowedAttributes: {} })

    // Gate Telegram integration behind TELEGRAM_ENABLED feature flag (default false / inert)
    const isTelegramEnabled = process.env.TELEGRAM_ENABLED === 'true'
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID

    let telegramStatus: 'sent' | 'failed' | 'not_configured' = 'not_configured'
    let telegramError: string | undefined = undefined

    if (isTelegramEnabled && telegramToken && telegramChatId) {
      const msg = `📢 *${cleanTitle}* (${priority.toUpperCase()})\n\n${cleanBody}`
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramChatId, text: msg, parse_mode: 'Markdown' }),
        })
        const tgData = await tgRes.json().catch(() => ({}))
        if (tgRes.ok && tgData.ok) {
          telegramStatus = 'sent'
        } else {
          telegramStatus = 'failed'
          telegramError = tgData.description || `HTTP status ${tgRes.status}`
        }
      } catch (tgErr: unknown) {
        console.warn('[API notify/announcement] Telegram broadcast error:', tgErr)
        const tgErrMsg = tgErr instanceof Error ? tgErr.message : 'Network error sending to Telegram'
        telegramStatus = 'failed'
        telegramError = tgErrMsg
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Announcement notification processed',
        telegram: {
          status: telegramStatus,
          error: telegramError
        }
      }
    })
  } catch (err: unknown) {
    console.error('[API notify/announcement] Error:', err)
    const message = err instanceof Error ? err.message : 'Server error sending announcement notification'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
