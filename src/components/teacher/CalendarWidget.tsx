'use client'
import { useState } from 'react'
import { H } from '@/lib/honey'
import { createStyles } from '@/lib/styles'

export default function CalendarWidget() {
  const now   = new Date()
  const [yr, setYr]  = useState(now.getFullYear())
  const [mo, setMo]  = useState(now.getMonth())
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)
  const today = now.getDate()
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const firstDay = new Date(yr, mo, 1).getDay()
  const daysInMonth = new Date(yr, mo + 1, 0).getDate()
  const prev = () => { if(mo===0){setMo(11);setYr(y=>y-1)}else setMo(m=>m-1) }
  const next = () => { if(mo===11){setMo(0);setYr(y=>y+1)}else setMo(m=>m+1) }
  const days: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]
  while (days.length % 7 !== 0) days.push(null)

  const styles = createStyles({
    card: { background: H.surface, borderRadius: 16, border: `1px solid ${H.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' },
    container: { flex:1, display:'flex', flexDirection:'column' },
    header: { padding:'16px 20px', borderBottom:`1px solid ${H.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' },
    title: { fontFamily: H.font, fontSize: 16, fontWeight: 800, color: H.text, margin:0 },
    buttonContainer: { display:'flex', gap:6 },
    button: { width:32, height:32, borderRadius:8, border:`1px solid ${H.border}`, background:'transparent', cursor:'pointer', color: H.text, fontWeight:700, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s' },
    content: { padding:'20px', flex:1 },
    month: { marginBottom:12, textAlign:'center', fontFamily:H.font, fontSize:14, fontWeight:700, color: H.text },
    grid: { display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 },
    day: { textAlign:'center', fontFamily:H.font, fontSize:11, fontWeight:700, color: H.muted, textTransform:'uppercase', paddingBottom:6 },
    date: {
      aspectRatio:'1/1', display:'flex', alignItems:'center', justifyContent:'center',
      borderRadius:10, fontFamily:H.font,
      transition: 'background 0.15s',
    },
  });

  return (
    <div style={{ ...styles.card, ...styles.container }}>
      <div style={styles.header}>
        <h3 style={styles.title}>School Calendar</h3>
        <div style={styles.buttonContainer}>
          {[['←', prev],['→', next]].map(([lbl, fn]:any) => (
            <button key={lbl} onClick={fn}
              style={{...styles.button, background: hoveredButton === lbl ? H.accentLight : 'transparent'}}
              onMouseEnter={() => setHoveredButton(lbl)}
              onMouseLeave={() => setHoveredButton(null)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.content}>
        <div style={styles.month}>
          {monthNames[mo]} {yr}
        </div>
        <div style={styles.grid}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={styles.day}>{d}</div>
          ))}
          {days.map((d, i) => {
            const isToday = d === today && mo === now.getMonth() && yr === now.getFullYear()
            const isEmpty = d === null
            return (
              <div key={i} style={{
                ...styles.date,
                fontWeight: isEmpty?400:700, fontSize: isEmpty?13:14,
                color: isEmpty ? 'transparent' : isToday ? '#FFFFFF' : H.text,
                background: isToday ? H.honey : (hoveredDay === d ? H.accentLight : 'transparent'),
                cursor: d ? 'pointer' : 'default',
              }}
                onMouseEnter={()=>{ if(d&&!isToday) setHoveredDay(d) }}
                onMouseLeave={()=>{ if(d&&!isToday) setHoveredDay(null) }}>
                {d || ''}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
