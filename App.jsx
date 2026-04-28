// ============================================================
//  POOPIFY — App.jsx  v2
//  New in this version:
//    • ShareCard component — generates a beautiful image card
//    • After every log → Share modal pops up
//    • Uses html2canvas to render card as PNG
//    • Web Share API for native mobile sharing
//    • Fallback: download as image
// ============================================================

import { useState, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'

// ─── Constants ───────────────────────────────────────────────

const BRISTOL_DATA = [
  { icon: '🪨', label: 'Hard lumps',  desc: 'Type 1: Separate hard lumps, like nuts. Indicates severe constipation.' },
  { icon: '🟤', label: 'Lumpy log',   desc: 'Type 2: Sausage-shaped but lumpy. Indicates mild constipation.' },
  { icon: '🌭', label: 'Cracked log', desc: 'Type 3: Like a sausage but with cracks on surface. Normal range.' },
  { icon: '💩', label: 'Smooth log',  desc: 'Type 4: Like a sausage or snake — smooth and soft. The golden type!' },
  { icon: '🫧', label: 'Soft blobs',  desc: 'Type 5: Soft blobs with clear-cut edges. Lacking fibre.' },
  { icon: '💧', label: 'Mushy',       desc: 'Type 6: Fluffy pieces with ragged edges — a mushy stool. Mild diarrhea.' },
  { icon: '🌊', label: 'Liquid',      desc: 'Type 7: Entirely liquid. No solid pieces. Severe diarrhea.' },
]

// Fun messages shown on share card based on bristol type
const SHARE_MESSAGES = [
  { headline: 'Solid effort... literally.',   sub: 'Drink more water, champ 💧'         },
  { headline: 'Almost there!',                sub: 'More fibre and you\'re golden 🌾'    },
  { headline: 'Looking good!',                sub: 'One step away from perfection 👏'    },
  { headline: 'PERFECT. GOLDEN. LEGENDARY.', sub: 'The Type 4 Champion has arrived 🏆'  },
  { headline: 'A bit too easy today?',        sub: 'Load up on that fibre 🥦'            },
  { headline: 'A little loose today.',        sub: 'Maybe skip the spicy food 🌶️'        },
  { headline: 'Oof. Stay hydrated.',          sub: 'Your gut needs some love today 💙'   },
]

const STREAK_TITLES = [
  '', 'First Flush 🚿', 'Double Drop 💪', 'Triple Threat 🔥',
  'Quad Squad 💥', 'High Five 🙌', 'Six Shooter 🎯', 'Week Warrior 🏅',
]

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const BADGE_COLORS = ['#b83232','#b06020','#967000','#1e7c3e','#1356a8','#6a1b9a','#880e4f']

// ─── LocalStorage helpers ─────────────────────────────────────

function getLogs() {
  try { return JSON.parse(localStorage.getItem('poopify_logs') || '[]') }
  catch { return [] }
}
function saveLogs(logs) {
  localStorage.setItem('poopify_logs', JSON.stringify(logs))
}function clearLogs() {
  localStorage.removeItem('poopify_logs')
}
// ─── Stat helpers ─────────────────────────────────────────────

function formatTime(ts) {
  const d = new Date(ts)
  const h = d.getHours(), m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
}
function formatDate(ts) {
  const d    = new Date(ts)
  const now  = new Date(); now.setHours(0,0,0,0)
  const yest = new Date(now); yest.setDate(now.getDate()-1)
  const day  = new Date(d);   day.setHours(0,0,0,0)
  if (day.getTime() === now.getTime())  return 'Today'
  if (day.getTime() === yest.getTime()) return 'Yesterday'
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}
function calcStreak(logs) {
  if (!logs.length) return 0
  const today  = new Date(); today.setHours(0,0,0,0)
  const daySet = new Set(logs.map(l => {
    const d = new Date(l.ts); d.setHours(0,0,0,0); return d.getTime()
  }))
  let streak = 0
  const cursor = new Date(today)
  while (daySet.has(cursor.getTime())) {
    streak++
    cursor.setDate(cursor.getDate()-1)
  }
  return streak
}
function todayCount(logs) {
  const today = new Date(); today.setHours(0,0,0,0)
  return logs.filter(l => {
    const d = new Date(l.ts); d.setHours(0,0,0,0)
    return d.getTime() === today.getTime()
  }).length
}
function get7DayData(logs) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-(6-i))
    const count = logs.filter(l => {
      const ld = new Date(l.ts); ld.setHours(0,0,0,0)
      return ld.getTime() === d.getTime()
    }).length
    return { label: DAYS[d.getDay()], count }
  })
}
function getPersonality(logs) {
  if (!logs.length) return { emoji:'🚽', type:'The Beginner',   desc:'Tap the big brown button to start your gut-health journey!' }
  const avg = logs.reduce((s,l) => s+l.bristol,0) / logs.length
  if (avg <= 2)   return { emoji:'🪨', type:'The Rock',         desc:'Your gut needs more water and fibre. Consider a doctor visit.' }
  if (avg <= 4)   return { emoji:'🏆', type:'The Champion',     desc:'Near-perfect regularity! Your gut microbiome is thriving.' }
  if (avg <= 5.5) return { emoji:'💨', type:'The Sprinter',     desc:'Things move fast for you. A probiotic might help.' }
  return              { emoji:'🌊', type:'The Waterfall',        desc:'Stay hydrated and consider booking a GP appointment.' }
}

// ─── Custom Recharts Tooltip ──────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:'#fffaf4', borderRadius:10, padding:'8px 14px',
      boxShadow:'0 4px 16px rgba(74,44,26,0.2)', border:'1px solid #f0d5b8',
      fontFamily:'Nunito,sans-serif',
    }}>
      <p style={{fontSize:12,fontWeight:800,color:'#7a5a42',marginBottom:2}}>{label}</p>
      <p style={{fontSize:15,fontWeight:900,color:'#4a2c1a'}}>
        {payload[0].value} {payload[0].value===1?'log':'logs'}
      </p>
    </div>
  )
}

// ============================================================
//  SHARE CARD — the thing that gets screenshotted
//  Rendered off-screen, captured by html2canvas
// ============================================================

function ShareCard({ log, streak, totalToday, cardRef }) {
  const bristol  = log.bristol
  const msg      = SHARE_MESSAGES[bristol - 1]
  const bData    = BRISTOL_DATA[bristol - 1]
  const streakTitle = streak <= 7 ? STREAK_TITLES[streak] : `${streak}-Day Streak 🔥`

  // Card gradient per bristol type
  const gradients = [
    'linear-gradient(145deg,#7b1a1a,#c0392b)',
    'linear-gradient(145deg,#7a3b10,#c0622b)',
    'linear-gradient(145deg,#6b5200,#c09600)',
    'linear-gradient(145deg,#1a4d2e,#27ae60)',
    'linear-gradient(145deg,#0d3d6b,#2980b9)',
    'linear-gradient(145deg,#3d1458,#8e44ad)',
    'linear-gradient(145deg,#5c0a2e,#c0114f)',
  ]

  return (
    <div
      ref={cardRef}
      style={{
        width: 400,
        height: 400,
        background: gradients[bristol - 1],
        borderRadius: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 28px',
        fontFamily: 'Nunito, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Background decoration circles */}
      <div style={{
        position:'absolute', top:-60, right:-60,
        width:220, height:220, borderRadius:'50%',
        background:'rgba(255,255,255,0.06)',
      }} />
      <div style={{
        position:'absolute', bottom:-40, left:-40,
        width:160, height:160, borderRadius:'50%',
        background:'rgba(255,255,255,0.05)',
      }} />

      {/* Top: app name */}
      <p style={{
        fontSize:13, fontWeight:800, color:'rgba(255,255,255,0.5)',
        letterSpacing:3, textTransform:'uppercase', marginBottom:16,
      }}>
        Poopify
      </p>

      {/* Big emoji */}
      <div style={{ fontSize:80, lineHeight:1, marginBottom:16 }}>
        {bData.icon}
      </div>

      {/* Bristol type badge */}
      <div style={{
        background:'rgba(255,255,255,0.18)', borderRadius:20,
        padding:'6px 18px', marginBottom:18,
        fontSize:13, fontWeight:800, color:'white', letterSpacing:0.5,
      }}>
        Bristol Type {bristol} · {bData.label}
      </div>

      {/* Main headline */}
      <p style={{
        fontSize:22, fontWeight:900, color:'white',
        textAlign:'center', lineHeight:1.2, marginBottom:8,
      }}>
        {msg.headline}
      </p>

      {/* Sub message */}
      <p style={{
        fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.75)',
        textAlign:'center', marginBottom:24,
      }}>
        {msg.sub}
      </p>

      {/* Stats row */}
      <div style={{
        display:'flex', gap:16,
        background:'rgba(255,255,255,0.13)',
        borderRadius:16, padding:'12px 20px',
      }}>
        {[
          { val: totalToday, label: 'Today' },
          { val: streak,     label: streakTitle || 'Day Streak 🔥' },
        ].map((s,i) => (
          <div key={i} style={{ textAlign:'center' }}>
            <div style={{ fontSize:26, fontWeight:900, color:'white', lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.6)', marginTop:3, textTransform:'uppercase', letterSpacing:0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bottom watermark */}
      <p style={{
        position:'absolute', bottom:16,
        fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)',
        letterSpacing:1,
      }}>
        poopify.app
      </p>
    </div>
  )
}

// ============================================================
//  SHARE MODAL — shown after every log
// ============================================================

function ShareModal({ log, streak, totalToday, onClose }) {
  const cardRef    = useRef()
  const [loading,  setLoading]  = useState(false)
  const [captured, setCaptured] = useState(null) // base64 PNG

  // Dynamically load html2canvas from CDN
  async function loadHtml2Canvas() {
    if (window.html2canvas) return window.html2canvas
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      s.onload  = () => resolve(window.html2canvas)
      s.onerror = reject
      document.head.appendChild(s)
    })
  }

  async function captureCard() {
    setLoading(true)
    try {
      const h2c     = await loadHtml2Canvas()
      const canvas  = await h2c(cardRef.current, {
        scale: 2, useCORS: true, backgroundColor: null,
        logging: false,
      })
      const dataUrl = canvas.toDataURL('image/png')
      setCaptured(dataUrl)
    } catch (e) {
      console.error('Capture failed', e)
    }
    setLoading(false)
  }

  // Auto-capture when modal mounts
  useState(() => { setTimeout(captureCard, 300) }, [])

  async function handleShare() {
    if (!captured) return
    // Try native Web Share API (works on mobile)
    if (navigator.share) {
      try {
        const blob = await (await fetch(captured)).blob()
        const file = new File([blob], 'poopify-share.png', { type:'image/png' })
        await navigator.share({
          title: 'My Poopify Score 💩',
          text:  `Bristol Type ${log.bristol} — ${SHARE_MESSAGES[log.bristol-1].headline} Track your gut on Poopify!`,
          files: [file],
        })
        return
      } catch {}
    }
    // Fallback: download
    handleDownload()
  }

  function handleDownload() {
    if (!captured) return
    const a    = document.createElement('a')
    a.href     = captured
    a.download = 'poopify-share.png'
    a.click()
  }

  function handleCopyText() {
    const text = `Bristol Type ${log.bristol} — ${SHARE_MESSAGES[log.bristol-1].headline}\n${SHARE_MESSAGES[log.bristol-1].sub}\nTrack your gut health on Poopify! 💩`
    navigator.clipboard?.writeText(text)
    alert('Caption copied! Paste it alongside your screenshot 📋')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />

        <p className="modal-title">Share your result! 🎉</p>
        <p className="modal-sub">Show off your gut health to the world</p>

        {/* Hidden card for capture — rendered off-screen */}
        <div style={{ position:'fixed', left:'-9999px', top:0, zIndex:-1 }}>
          <ShareCard
            log={log}
            streak={streak}
            totalToday={totalToday}
            cardRef={cardRef}
          />
        </div>

        {/* Preview */}
        <div className="share-preview-wrap">
          {loading && (
            <div className="share-loading">
              <div className="share-spinner" />
              <p>Generating your card...</p>
            </div>
          )}
          {captured && !loading && (
            <img
              src={captured}
              alt="Share card preview"
              className="share-preview-img"
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="share-actions">
          <button className="share-btn-primary" onClick={handleShare} disabled={!captured || loading}>
            {navigator.share ? '📤 Share to Apps' : '📥 Download Image'}
          </button>
          <button className="share-btn-secondary" onClick={handleDownload} disabled={!captured || loading}>
            💾 Save to Phone
          </button>
          <button className="share-btn-secondary" onClick={handleCopyText}>
            📋 Copy Caption
          </button>
        </div>

        <button className="cancel-btn" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  )
}

// ============================================================
//  QUICK-LOG MODAL
// ============================================================

function LogModal({ onSave, onClose }) {
  const [selected, setSelected] = useState(4)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">How was it? 🚽</p>
        <p className="modal-sub">Bristol Stool Scale — Type 4 is the ideal</p>

        <div className="bristol-scale">
          {BRISTOL_DATA.map((b,i) => (
            <button
              key={i}
              className={`bristol-btn${selected===i+1?' selected':''}`}
              onClick={() => setSelected(i+1)}
            >
              <span className="b-num">{i+1}</span>
              <span className="b-icon">{b.icon}</span>
              <span className="b-label">{b.label}</span>
            </button>
          ))}
        </div>

        <div className="bristol-desc">
          <p>{BRISTOL_DATA[selected-1].desc}</p>
        </div>

        <button className="save-btn" onClick={() => onSave(selected)}>
          Save Log ✓
        </button>
        <button className="cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ============================================================
//  HOME PAGE
// ============================================================

function HomePage({ logs, onLog }) {
  const [btnPressed,  setBtnPressed]  = useState(false)
  const [showLog,     setShowLog]     = useState(false)
  const [shareData,   setShareData]   = useState(null) // { log, streak, totalToday }
  const btnRef = useRef()

  const streak = calcStreak(logs)
  const tc     = todayCount(logs)
  const recent = [...logs].sort((a,b) => b.ts-a.ts).slice(0,5)

  function handleBigBtn(e) {
    if (navigator.vibrate) navigator.vibrate([30,10,40])
    if (btnRef.current) {
      const rect   = btnRef.current.getBoundingClientRect()
      const size   = Math.max(rect.width, rect.height)
      const ripple = document.createElement('span')
      ripple.className  = 'ripple'
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`
      btnRef.current.appendChild(ripple)
      setTimeout(() => ripple.remove(), 700)
    }
    setBtnPressed(true)
    setTimeout(() => setBtnPressed(false), 400)
    setShowLog(true)
  }

  function handleSave(bristol) {
    const newLog  = { ts: Date.now(), bristol }
    const updated = [newLog, ...logs]
    saveLogs(updated)
    onLog(updated)
    setShowLog(false)
    // Show share modal with fresh stats
    setShareData({
      log:        newLog,
      streak:     calcStreak(updated),
      totalToday: todayCount(updated),
    })
  }

  function handleReset() {
    if (!window.confirm('Reset all logs? This will clear your history permanently.')) return
    clearLogs()
    onLog([])
  }

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <p className="hero-title">🚽 Tap to Log</p>
        <div className="big-btn-wrap">
          <button
            ref={btnRef}
            className={`big-btn${btnPressed?' pressed':''}`}
            onClick={handleBigBtn}
            aria-label="Log a bowel movement"
          >
            <span className="big-btn-emoji">💩</span>
          </button>
        </div>
        <p className="btn-hint">Press and log your throne moment</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-num">{tc}</div>
          <div className="stat-label">Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{streak}🔥</div>
          <div className="stat-label">Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{logs.length}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      <div style={{ textAlign:'center', marginTop:12 }}>
        <button
          className="cancel-btn"
          onClick={handleReset}
          style={{
            padding:'10px 18px', borderRadius:999,
            border:'1px solid rgba(255,255,255,0.2)',
            background:'rgba(255,255,255,0.08)', color:'white',
            fontWeight:700, cursor:'pointer', minWidth:140,
          }}
        >
          Reset logs
        </button>
      </div>

      {/* Recent logs */}
      <div className="page" style={{ paddingTop:4 }}>
        <div className="section-title">Recent Logs</div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🪑</div>
            <div className="empty-text">No logs yet. Time to sit down!</div>
          </div>
        ) : (
          <div className="log-list">
            {recent.map((log,i) => (
              <div key={i} className="log-item" style={{ animationDelay:`${i*50}ms` }}>
                <span className="log-icon">{BRISTOL_DATA[log.bristol-1].icon}</span>
                <div className="log-info">
                  <div className="log-time">{formatTime(log.ts)}</div>
                  <div className="log-date">{formatDate(log.ts)}</div>
                </div>
                <span
                  className={`log-badge bristol-${log.bristol}`}
                  style={{ background:BADGE_COLORS[log.bristol-1]+'22', color:BADGE_COLORS[log.bristol-1] }}
                >
                  Type {log.bristol}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showLog && <LogModal onSave={handleSave} onClose={() => setShowLog(false)} />}
      {shareData && (
        <ShareModal
          log={shareData.log}
          streak={shareData.streak}
          totalToday={shareData.totalToday}
          onClose={() => setShareData(null)}
        />
      )}
    </>
  )
}

// ============================================================
//  STATS / DASHBOARD PAGE
// ============================================================

function DashPage({ logs }) {
  const chartData     = get7DayData(logs)
  const streak        = calcStreak(logs)
  const tc            = todayCount(logs)
  const maxBar        = Math.max(...chartData.map(d => d.count), 1)
  const bristolCounts = Array(7).fill(0)
  logs.forEach(l => bristolCounts[l.bristol-1]++)
  const maxBC      = Math.max(...bristolCounts, 1)
  const activeDays = chartData.filter(d => d.count>0).length
  const avgPerDay  = activeDays ? (logs.length/activeDays).toFixed(1) : '0'

  return (
    <div className="page">
      <div className="streak-banner">
        <div className="streak-num">{streak}</div>
        <div className="streak-info">
          <h3>Day Streak 🔥</h3>
          <p>{streak===0?'Log today to start!':streak===1?'Great start — keep going!':"You're on a roll!"}</p>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">7-Day Frequency</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,149,106,0.18)" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontFamily:'Nunito',fontWeight:700,fontSize:11,fill:'#7a5a42' }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontFamily:'Nunito',fontWeight:700,fontSize:11,fill:'#7a5a42' }} domain={[0,maxBar+1]} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(196,149,106,0.12)',radius:8 }} />
            <Bar dataKey="count" radius={[8,8,4,4]} maxBarSize={36}>
              {chartData.map((entry,i) => (
                <Cell key={i} fill={entry.count===maxBar && entry.count>0 ? '#8b5e3c' : '#c4956a'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <div className="chart-title">Bristol Distribution</div>
        <div className="bristol-dist">
          {bristolCounts.map((c,i) => (
            <div key={i} className="dist-row">
              <div className="dist-label">{BRISTOL_DATA[i].icon} T{i+1}</div>
              <div className="dist-bar-bg">
                <div className="dist-bar" style={{ width:`${Math.round(c/maxBC*100)}%` }} />
              </div>
              <div className="dist-count">{c}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Quick Stats</div>
        <div className="quick-stats-grid">
          {[
            { label:'Today',       val:`${tc} logs`  },
            { label:'This Week',   val:`${chartData.reduce((s,d)=>s+d.count,0)} logs` },
            { label:'Avg / Day',   val:avgPerDay      },
            { label:'Perfect T4s', val:`${bristolCounts[3]}` },
          ].map((s,i) => (
            <div key={i} className="qs-card">
              <div className="qs-val">{s.val}</div>
              <div className="qs-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  WRAPPED PAGE
// ============================================================

function WrappedPage({ logs }) {
  const personality  = getPersonality(logs)
  const totalLogs    = logs.length
  const year         = new Date().getFullYear()
  const monthCounts  = Array(12).fill(0)
  logs.forEach(l => monthCounts[new Date(l.ts).getMonth()]++)
  const bestMonthIdx = monthCounts.indexOf(Math.max(...monthCounts))
  const bestMonth    = MONTHS[bestMonthIdx]
  const totalHrs     = Math.round(totalLogs*8/60)
  const pooPoints    = totalLogs*100 + logs.filter(l=>l.bristol===4).length*50

  return (
    <div className="wrapped-page">
      <div className="wrapped-header">
        <div className="wrapped-year">{year} Wrapped</div>
        <div className="wrapped-title">Your Poo<br /><span>Story</span></div>
      </div>
      <div className="wrapped-personality">
        <span className="personality-emoji">{personality.emoji}</span>
        <div className="personality-type">{personality.type}</div>
        <div className="personality-desc">{personality.desc}</div>
      </div>
      <div className="wrapped-card wc-gold">
        <div className="wrapped-card-label">Poo-Points Earned</div>
        <div className="wrapped-card-num">{pooPoints.toLocaleString()}</div>
        <div className="wrapped-card-desc">+50 bonus per perfect Type 4</div>
        <div className="wrapped-card-sub">Based on {totalLogs} total logs</div>
      </div>
      <div className="wrapped-card wc-teal">
        <div className="wrapped-card-label">Most Active Month</div>
        <div className="wrapped-card-num">{totalLogs>0?bestMonth:'—'}</div>
        <div className="wrapped-card-desc">{totalLogs>0?`${monthCounts[bestMonthIdx]} logs in ${bestMonth}`:'Keep logging to find out!'}</div>
        <div className="wrapped-card-sub">Your gut was busiest then</div>
      </div>
      <div className="wrapped-card wc-purple">
        <div className="wrapped-card-label">Throne Time</div>
        <div className="wrapped-card-num">{totalHrs}h</div>
        <div className="wrapped-card-desc">~{totalLogs*8} total minutes</div>
        <div className="wrapped-card-sub">Estimated at 8 min per session</div>
      </div>
      <div className="wrapped-card wc-coral">
        <div className="wrapped-card-label">Total Logs</div>
        <div className="wrapped-card-num">{totalLogs}</div>
        <div className="wrapped-card-desc">{totalLogs>0?'A dedicated gut-health tracker!':'Start logging to see your story'}</div>
        <div className="wrapped-card-sub">Every poo counts 💩</div>
      </div>
      <div className="wrapped-footer">Poopify • Your Gut, Your Data</div>
    </div>
  )
}

// ============================================================
//  APP ROOT
// ============================================================

export default function App() {
  const [tab,  setTab]  = useState('home')
  const [logs, setLogs] = useState(() => getLogs())

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-logo">Poo<span>pify</span></div>
        <div className="nav-tabs">
          {[
            { id:'home',    label:'🏠 Home'    },
            { id:'dash',    label:'📊 Stats'   },
            { id:'wrapped', label:'🎁 Wrapped' },
          ].map(t => (
            <button
              key={t.id}
              className={`nav-tab${tab===t.id?' active':''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab==='home'    && <HomePage    logs={logs} onLog={setLogs} />}
      {tab==='dash'    && <DashPage    logs={logs} />}
      {tab==='wrapped' && <WrappedPage logs={logs} />}
    </div>
  )
}
