'use client'
import { useState, useEffect } from 'react'
import { H } from '@/lib/honey'
import { createStyles } from '@/lib/styles'

export default function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const h = time.getHours()
  const m = String(time.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12

  const styles = createStyles({
    container: { display:'flex', flexDirection:'column', alignItems:'center', gap:4 },
    time: { fontFamily: H.font, fontSize: 52, fontWeight: 900, color: H.honey, letterSpacing: '-0.04em', lineHeight:1, fontVariantNumeric:'tabular-nums' },
    ampm: { fontFamily: H.font, fontSize: 13, fontWeight: 800, color: H.chocolate, background: H.accentLight, padding: '3px 14px', borderRadius: 20, border: `1px solid ${H.border}`, letterSpacing: '0.15em', textTransform: 'uppercase' },
  });

  return (
    <div style={styles.container}>
      <div style={styles.time}>
        {String(h12).padStart(2,'0')}:{m}
      </div>
      <div style={styles.ampm}>
        {ampm}
      </div>
    </div>
  )
}
