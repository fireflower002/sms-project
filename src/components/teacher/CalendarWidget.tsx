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
    card: { background: H.surface, borderRadius: H.radius['2xl'], border: `1px solid ${H.border}`, boxShadow: H.shadows.card, overflow: 'hidden' },
    container: { flex:1, display:'flex', flexDirection:'column' },
    header: { padding:`${H.spacing.lg} ${H.spacing.xl}`, borderBottom:`1px solid ${H.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' },
    title: { fontFamily: H.font, fontSize: H.fontSize.lg, fontWeight: H.fontWeight.extrabold, color: H.text, margin:0 },
    buttonContainer: { display:'flex', gap:6 },
    button: { width:32, height:32, borderRadius:H.radius.md, border:`1px solid ${H.border}`, background:'transparent', cursor:'pointer', color: H.text, fontWeight:H.fontWeight.bold, fontSize:H.fontSize.base, display:'flex', alignItems:'center', justifyContent:'center', transition:H.motion.transitionFast },
    content: { padding:H.spacing.xl, flex:1 },
    month: { marginBottom:H.spacing.md, textAlign:'center', fontFamily:H.font, fontSize:H.fontSize.base, fontWeight:H.fontWeight.bold, color: H.text },
    grid: { display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 },
    day: { textAlign:'center', fontFamily:H.font, fontSize:H.fontSize.xs, fontWeight:H.fontWeight.bold, color: H.muted, textTransform:'uppercase', paddingBottom:6 },
    date: {
      aspectRatio:'1/1', display:'flex', alignItems:'center', justifyContent:'center',
      borderRadius:H.radius.lg, fontFamily:H.font,
      transition: H.motion.transitionFast,
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
