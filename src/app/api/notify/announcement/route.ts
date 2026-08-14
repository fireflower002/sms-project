import { NextResponse } from 'next/server'
import { z } from 'zod'

const notifyAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional().default(''),
  priority: z.string().optional().default('normal'),
})

export async function POST(request: Request) {
  try {
    const jsonBody = await request.json().catch(() => ({}))
    const parseResult = notifyAnnouncementSchema.safeParse(jsonBody)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid announcement notification payload'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { title, body, priority } = parseResult.data

    // If Telegram bot token & chat ID are configured in environment variables, forward notification
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID

    let telegramStatus: 'sent' | 'failed' | 'not_configured' = 'not_configured'
    let telegramError: string | undefined = undefined

    if (telegramToken && telegramChatId) {
      const msg = `📢 *${title}* (${priority.toUpperCase()})\n\n${body}`
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
      } catch (tgErr: any) {
        console.warn('[API notify/announcement] Telegram broadcast error:', tgErr)
        telegramStatus = 'failed'
        telegramError = tgErr?.message || 'Network error sending to Telegram'
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Announcement notification processed',
      telegram: {
        status: telegramStatus,
        error: telegramError
      }
    })
  } catch (err: any) {
    console.error('[API notify/announcement] Error:', err)
    return NextResponse.json({ error: err?.message || 'Server error sending announcement notification' }, { status: 500 })
  }
}
