import { useState, useEffect, useRef } from 'react'
import type { Step, ProjectRecord } from './types'
import { saveProject, loadProjects, deleteProject, saveProgress, loadProgressList, deleteProgress, clearProgress } from './storage'
import type { Progress } from './storage'

const LIMIT = 12 * 3600

const makeSteps = (): Step[] => [
  { id:1, name:'몸통/다리', emoji:'🪵', totalSeconds:3*3600+30*60, timeLeft:3*3600+30*60, running:false, done:false, parallel:true },
  { id:2, name:'문 가공+조립', emoji:'🚪', totalSeconds:3600, timeLeft:3600, running:false, done:false, parallel:true },
  { id:3, name:'서랍 가공+조립', emoji:'🗄️', totalSeconds:2*3600, timeLeft:2*3600, running:false, done:false, parallel:true },
  { id:4, name:'몸통/다리 결합', emoji:'🔨', totalSeconds:3600, timeLeft:3600, running:false, done:false, parallel:false },
  { id:5, name:'문 달기', emoji:'🪛', totalSeconds:3600, timeLeft:3600, running:false, done:false, parallel:false },
  { id:6, name:'서랍 달기', emoji:'✨', totalSeconds:3600, timeLeft:3600, running:false, done:false, parallel:false },
  { id:7, name:'마무리', emoji:'🎀', totalSeconds:3600, timeLeft:3600, running:false, done:false, parallel:false },
]

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function fmtDate(d: Date) {
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

type Screen = 'intro' | 'naming' | 'timer'

const font = "'Noto Sans KR', sans-serif"

export default function App() {
  const progressList = loadProgressList()
  const [screen, setScreen] = useState<Screen>(progressList.length > 0 ? 'intro' : 'naming')
  const [projectName, setProjectName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [steps, setSteps] = useState<Step[]>(makeSteps())
  const [started, setStarted] = useState(false)
  const [limitLeft, setLimitLeft] = useState(LIMIT)
  const [page, setPage] = useState<'timer'|'history'>('timer')
  const [projects, setProjects] = useState<ProjectRecord[]>(loadProjects())
  const [progList, setProgList] = useState<Progress[]>(progressList)
  const [saveMsg, setSaveMsg] = useState('')
  const [showParallelResult, setShowParallelResult] = useState(false)
  const [showSeqResult, setShowSeqResult] = useState(false)
  const intervalRef = useRef<any>(null)

  // 앱 시작 시 인트로 음성 재생
  useEffect(() => {
    if (!introPlayedRef.current) {
      introPlayedRef.current = true
      const audio = new Audio('/intro.mp3.m4a')
      audio.play().catch(() => {})
    }
  }, [])
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastTickRef.current = Date.now()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const anyRunning = steps.some(s => s.running)
  const allDone = steps.every(s => s.done)
  const lastTickRef = useRef<number>(Date.now())
  const introPlayedRef = useRef(false)

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (!started || !anyRunning) return
    lastTickRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const delta = Math.round((now - lastTickRef.current) / 1000)
      lastTickRef.current = now
      const tick = Math.max(1, delta) // 잠금 해제 시 실제 경과 시간 반영
      setSteps(prev => prev.map(s => {
        if (!s.running || s.done) return s
        const t = Math.max(0, s.timeLeft - tick)
        const elapsed = (s.elapsedSeconds ?? 0) + tick
        if (t <= 0) {
          try { new Audio('https://www.soundjay.com/buttons/beep-01a.mp3').play() } catch {}
          if (navigator.vibrate) navigator.vibrate([400,200,400])
          setTimeout(() => alert(`${s.emoji} "${s.name}" 시간 완료! ⏰`), 50)
          return { ...s, timeLeft: 0, running: false, elapsedSeconds: elapsed }
        }
        return { ...s, timeLeft: t, elapsedSeconds: elapsed }
      }))
setLimitLeft(t => {
        const next = t - tick
        if (next <= 0) {
          try { new Audio('https://www.soundjay.com/buttons/beep-01a.mp3').play() } catch {}
          alert('⚠️ 12시간 초과!')
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [started, anyRunning])

  useEffect(() => {
    if (allDone && started) {
      const record: ProjectRecord = {
        id: Date.now().toString(),
        date: fmtDate(new Date()),
        name: projectName,
        steps: steps.map(s => ({ name: s.name, elapsedSeconds: s.elapsedSeconds ?? 0 })),
        totalSeconds: steps.reduce((a, s) => a + (s.elapsedSeconds ?? 0), 0),
        limitSeconds: LIMIT - limitLeft
      }
      saveProject(record)
      clearProgress()
      setProjects(loadProjects())
      setProgList(loadProgressList())
    }
  }, [allDone])

  const toggle = (id: number) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, running: !s.running } : s))
    if (!started) setStarted(true)
  }

const completeStep = (id: number) => {
    setSteps(prev => prev.map(s =>
      s.id === id
        ? { ...s, running: false, done: true, elapsedSeconds: s.elapsedSeconds ?? (s.totalSeconds - s.timeLeft) }
        : s
    ))
  }

  const handleSave = () => {
    saveProgress({
      projectName,
      steps: steps.map(s => ({ ...s, running: false })),
      limitLeft,
      savedAt: fmtDate(new Date())
    })
    setProgList(loadProgressList())
    setSaveMsg('저장됐어요! 💾')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const resumeProject = (p: Progress) => {
    setProjectName(p.projectName)
    setSteps(p.steps.map(s => ({ ...s, running: false })))
    setLimitLeft(p.limitLeft)
    setStarted(true)
    setScreen('timer')
  }

  const handleDeleteProgress = (id: string) => {
    deleteProgress(id)
    const updated = loadProgressList()
    setProgList(updated)
    if (updated.length === 0) setScreen('naming')
  }

  const handleDeleteProject = (id: string) => {
    deleteProject(id)
    setProjects(loadProjects())
  }

const startNew = () => {
    setSteps(makeSteps())
    setStarted(false)
    setLimitLeft(LIMIT)
    setProjectName('')
    setNameInput('')
    setShowParallelResult(false)
    setShowSeqResult(false)
    setScreen('naming')
  }


  const limitPct = Math.round(((LIMIT - limitLeft) / LIMIT) * 100)
  const limitColor = limitLeft < 3600 ? '#ff6b6b' : limitLeft < 7200 ? '#ffa94d' : '#69db7c'
 const card = { background: '#fff', borderRadius: '20px', padding: '16px', marginBottom: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1.5px solid #f5ece0' }

  // 🟡 인트로 화면
  if (screen === 'intro') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #fdf6ec, #fef9f0)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: font }}>
        <div style={{ maxWidth: '360px', width: '100%' }}>
          <div style={{ background: 'linear-gradient(135deg, #f9e4c8, #fce8d5)', borderRadius: '24px', padding: '32px 24px', textAlign: 'center', boxShadow: '0 4px 20px rgba(249,180,120,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🪑✨</div>
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#c47a3a', margin: '0 0 6px', letterSpacing: '-0.5px' }}>주히 금메달 프로젝트</h1>
            <p style={{ fontSize: '13px', color: '#d4956a', margin: '0 0 24px' }}>서랍장 제작 타이머 🏅</p>

            <p style={{ fontSize: '13px', fontWeight: '700', color: '#aaa', marginBottom: '10px', textAlign: 'left' }}>💾 저장된 프로젝트 ({progList.length}/3)</p>

            {progList.map(p => (
              <div key={p.id} style={{ background: '#fff8f0', borderRadius: '16px', padding: '14px', marginBottom: '10px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: '800', color: '#5a3e2b' }}>{p.projectName}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#bbb' }}>저장: {p.savedAt}</p>
                  </div>
                  <button onClick={() => handleDeleteProgress(p.id)} style={{ border: 'none', background: '#ffe0e0', color: '#e07070', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>삭제</button>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  {p.steps.filter(s => s.done).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: '#888' }}>✅ {s.name}</span>
                      <span style={{ fontSize: '12px', color: '#c47a3a', fontWeight: '700' }}>{fmt(s.elapsedSeconds ?? 0)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => resumeProject(p)} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: 'none', background: '#f9c88a', color: '#fff', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
                  ▶️ 이어서 하기
                </button>
              </div>
            ))}

            <button onClick={startNew} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px solid #f0e0d0', background: 'transparent', color: '#c47a3a', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginTop: '4px' }}>
              ✨ 새 프로젝트 시작
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 🟡 이름 입력 화면
  if (screen === 'naming') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #fdf6ec, #fef9f0)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: font }}>
        <div style={{ maxWidth: '360px', width: '100%' }}>
          <div style={{ background: 'linear-gradient(135deg, #f9e4c8, #fce8d5)', borderRadius: '24px', padding: '32px 24px', textAlign: 'center', boxShadow: '0 4px 20px rgba(249,180,120,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🪑✨</div>
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#c47a3a', margin: '0 0 4px', letterSpacing: '-0.5px' }}>주히 금메달 프로젝트</h1>
            <p style={{ fontSize: '13px', color: '#d4956a', margin: '0 0 28px' }}>서랍장 제작 타이머 🏅</p>
            <p style={{ fontSize: '15px', fontWeight: '700', color: '#5a3e2b', margin: '0 0 10px', textAlign: 'left' }}>📝 프로젝트 이름을 정해주세요</p>
            <input
              style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '2px solid #fde8c8', background: '#fff', fontSize: '16px', fontWeight: '600', color: '#5a3e2b', outline: 'none', boxSizing: 'border-box', marginBottom: '12px', fontFamily: font }}
              placeholder="예) 1호 서랍장, 거실 서랍장..."
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && nameInput.trim()) {
                  setProjectName(nameInput.trim())
                  setScreen('timer')
                }
              }}
            />
            <button
              style={{ width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: nameInput.trim() ? '#f9c88a' : '#f0e0d0', color: nameInput.trim() ? '#fff' : '#bbb', fontWeight: '900', fontSize: '17px', cursor: nameInput.trim() ? 'pointer' : 'default', fontFamily: font }}
              onClick={() => { if (nameInput.trim()) { setProjectName(nameInput.trim()); setScreen('timer') } }}>
              🚀 시작하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 🟡 메인 타이머 화면
  return (
  <div style={{ background: 'linear-gradient(160deg, #fdf6ec 0%, #fef4f0 50%, #fdf0f8 100%)', minHeight: '100vh', padding: '16px', fontFamily: font }}>
      <div style={{ maxWidth: '390px', margin: '0 auto' }}>

        {/* 배너 */}
<div style={{ background: 'linear-gradient(135deg, #ffecd2, #fcb69f22)', borderRadius: '24px', padding: '22px 20px', marginBottom: '12px', textAlign: 'center', boxShadow: '0 8px 32px rgba(249,180,120,0.25)', position: 'relative', overflow: 'hidden', border: '1.5px solid #fde8c8' }}>
          <div style={{ fontSize: '30px', marginBottom: '6px' }}>🪑✨</div>
          <h1 style={{ fontSize: '19px', fontWeight: '900', color: '#b86a2a', margin: '0 0 3px', letterSpacing: '-0.5px' }}>{projectName}</h1>
          <p style={{ fontSize: '12px', color: '#e0a070', margin: 0, fontWeight: '500' }}>서랍장 제작 타이머 &nbsp;🏅</p>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '70px', opacity: 0.07 }}>🪵</div>
        </div>
        {/* 탭 */}
<div style={{ display: 'flex', background: '#fff', borderRadius: '16px', padding: '4px', marginBottom: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1.5px solid #f5ece0' }}>
          {(['timer','history'] as const).map(t => (
            <button key={t} onClick={() => setPage(t)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: page === t ? 'linear-gradient(135deg, #f9c88a, #f4a261)' : 'transparent', color: page === t ? '#fff' : '#ccc', fontWeight: '800', fontSize: '14px', cursor: 'pointer', fontFamily: font, transition: 'all 0.2s' }}>
              {t === 'timer' ? '⏱ 타이머' : '📊 기록'}
            </button>
          ))}
        </div>

        {page === 'timer' && <>

{/* 12시간 + 저장/리셋 버튼 */}
          <div style={card}>
{/* 3등분 버튼 영역 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>

              {/* ⏳ 12시간 타이머 */}
              <div style={{ flex: 1, padding: '14px 8px', borderRadius: '14px', background: '#fff8f0', border: `2px solid ${limitColor}`, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '22px', fontWeight: '900', color: limitColor }}>{fmt(limitLeft)}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#aaa' }}>
                  {!anyRunning && started && !allDone ? '⏸ 정지 중' : '⏳ 남은 시간'}
                </span>
              </div>

              {/* 💾 중간 저장 */}
              <button
                onClick={handleSave}
                disabled={!started || allDone}
                style={{ flex: 1, padding: '14px 8px', borderRadius: '14px', border: 'none', background: !started || allDone ? '#f5f5f5' : saveMsg ? '#b8e0b0' : '#f9c88a', color: !started || allDone ? '#ccc' : '#fff', fontWeight: '900', fontSize: '13px', cursor: !started || allDone ? 'default' : 'pointer', fontFamily: font, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '22px' }}>{saveMsg ? '✅' : '💾'}</span>
                <span style={{ fontSize: '11px' }}>{saveMsg ? '저장완료!' : '중간 저장'}</span>
              </button>

              {/* 🔄 처음부터 */}
              <button
                onClick={() => { if (window.confirm('처음부터 다시 시작할까요?')) { clearInterval(intervalRef.current); clearProgress(); setSteps(makeSteps()); setStarted(false); setLimitLeft(LIMIT); setProjectName(''); setNameInput(''); setScreen('naming') } }}
                style={{ flex: 1, padding: '14px 8px', borderRadius: '14px', border: '2px solid #fde8c8', background: '#fff', color: '#c47a3a', fontWeight: '900', fontSize: '13px', cursor: 'pointer', fontFamily: font, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '22px' }}>🔄</span>
                <span style={{ fontSize: '11px' }}>처음부터</span>
              </button>

            </div>

            {/* 진행 바 */}
            <div style={{ background: '#f5f5f5', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${limitPct}%`, background: limitColor, borderRadius: '99px', transition: 'width 1s linear' }} />
            </div>
            <p style={{ fontSize: '11px', color: '#bbb', margin: '6px 0 0', textAlign: 'right' }}>{limitPct}% 사용됨</p>
          </div>

{/* 전체 완료 - 풀스크린 오버레이 */}
          {allDone && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' as const, padding: '32px 32px 100px', fontFamily: font, textAlign: 'center', overflowY: 'auto' as const }}>

              {/* 배경 파스텔 원들 */}
              <div style={{ position: 'absolute', top: '-60px', left: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, #ffd6e8, #ffe8f0)', opacity: 0.6 }} />
              <div style={{ position: 'absolute', bottom: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, #ffecd2, #fff3e0)', opacity: 0.6 }} />
              <div style={{ position: 'absolute', top: '40%', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, #e8f4fd, #ddeeff)', opacity: 0.5 }} />

              {/* 이모티콘 */}
              <div style={{ fontSize: '72px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>🪑✨</div>

              {/* 메인 텍스트 */}
              <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#c47a3a', margin: '0 0 12px', letterSpacing: '-1px', position: 'relative', zIndex: 1, lineHeight: 1.3 }}>
                서랍장 완성하느라<br />고생 많았어! 🎀
              </h1>

              <p style={{ fontSize: '16px', color: '#e8a0c0', fontWeight: '700', margin: '0 0 32px', position: 'relative', zIndex: 1 }}>
                정말 대단해 💪🏻✨
              </p>

              {/* 총 시간 */}
              <div style={{ background: 'linear-gradient(135deg, #fdf0f5, #fff0e8)', borderRadius: '20px', padding: '20px 32px', marginBottom: '20px', position: 'relative', zIndex: 1, boxShadow: '0 4px 20px rgba(249,180,120,0.2)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '700', color: '#e8a0c0' }}>⏱ 총 작업 시간</p>
                <p style={{ margin: 0, fontSize: '44px', fontWeight: '900', color: '#c47a3a', letterSpacing: '-2px' }}>
                  {fmt(steps.reduce((a, s) => a + (s.elapsedSeconds ?? 0), 0))}
                </p>
              </div>

              {/* 단계별 시간 */}
              <div style={{ width: '100%', maxWidth: '320px', position: 'relative', zIndex: 1, marginBottom: '28px' }}>
                {steps.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', marginBottom: '6px', background: '#fffaf5', borderRadius: '12px', border: '1.5px solid #fde8c8' }}>
                    <span style={{ fontSize: '14px', color: '#888' }}>{s.emoji} {s.name}</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#c47a3a' }}>{fmt(s.elapsedSeconds ?? 0)}</span>
                  </div>
                ))}
              </div>

              {/* 새 프로젝트 버튼 */}
              <button
                onClick={startNew}
                style={{ padding: '16px 40px', borderRadius: '20px', border: 'none', background: 'linear-gradient(135deg, #f9c88a, #f4a261)', color: '#fff', fontWeight: '900', fontSize: '16px', cursor: 'pointer', fontFamily: font, boxShadow: '0 4px 16px rgba(249,180,120,0.4)', position: 'relative', zIndex: 1 }}>
                🚀 새 프로젝트 시작
              </button>

            </div>
          )}

{/* 자유 진행 완료 결과 배너 */}
          {showParallelResult && (
            <div style={{ background: 'linear-gradient(135deg, #f9e4c8, #fce8d5)', borderRadius: '20px', padding: '24px 20px', marginBottom: '12px', textAlign: 'center', boxShadow: '0 4px 20px rgba(249,180,120,0.3)', position: 'relative' }}>
              <button
                onClick={() => setShowParallelResult(false)}
                style={{ position: 'absolute', top: '12px', right: '14px', border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#c47a3a' }}>✕</button>
              <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: '#d4956a' }}>⚡ 자유 진행 완료!</p>
              <p style={{ margin: '0 0 4px', fontSize: '48px', fontWeight: '900', color: '#c47a3a', letterSpacing: '-1px' }}>
                {fmt(steps.filter(s => s.parallel).reduce((a, s) => a + (s.elapsedSeconds ?? 0), 0))}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#d4956a' }}>총 소요 시간 🏅</p>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                {steps.filter(s => s.parallel).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#fff8f0', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>{s.emoji} {s.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#c47a3a' }}>{fmt(s.elapsedSeconds ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 자유 진행 */}
          <div style={card}>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <span style={{ fontWeight: '900', fontSize: '15px', color: '#c47a3a' }}>자유 진행</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
{/* ▶️ 시작 */}
                {steps.filter(s => s.parallel).some(s => !s.running && !s.done) && (
                  <button
                    onClick={() => {
                      setSteps(prev => {
                        const firstNotDone = prev.find(s => s.parallel && !s.done)
                        if (!firstNotDone) return prev
                        return prev.map(s =>
                          s.id === firstNotDone.id ? { ...s, running: true } : s.parallel ? { ...s, running: false } : s
                        )
                      })
                      if (!started) setStarted(true)
                    }}
                    style={{ padding: '10px 16px', borderRadius: '12px', border: 'none', background: '#f9c88a', color: '#fff', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: font }}>
                    ▶️ 시작
                  </button>
                )}
{/* ✅ 완료 */}
                {steps.filter(s => s.parallel).some(s => !s.done) && (
                  <button
                    onClick={() => {
                      setSteps(prev => {
                        // 모든 자유 진행 단계를 현재 경과 시간으로 저장하고 종료
                        const updated = prev.map(s =>
                          s.parallel
                            ? { ...s, running: false, done: true, elapsedSeconds: s.elapsedSeconds ?? 0 }
                            : s
                        )
                        setShowParallelResult(true)
                        // 자동 중간 저장
                        setTimeout(() => {
                          saveProgress({
                            projectName,
                            steps: updated.map(s => ({ ...s, running: false })),
                            limitLeft,
                            savedAt: fmtDate(new Date())
                          })
                          setProgList(loadProgressList())
                        }, 100)
                        return updated
                      })
                    }}
                    style={{ padding: '10px 16px', borderRadius: '12px', border: 'none', background: '#ffd6e0', color: '#c0446a', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: font }}>
                    ✅ 완료
                  </button>
                )}
              </div>
            </div>
            {steps.filter(s => s.parallel).map(s => (
              <div key={s.id} style={{ background: s.done ? '#f5f5f5' : s.running ? '#fff8f0' : '#fffaf5', borderRadius: '16px', padding: '14px', marginBottom: '8px', border: `2px solid ${s.done ? '#eee' : s.running ? '#f9c88a' : '#fde8c8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.done ? 0 : '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>{s.done ? '✅' : s.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: '800', fontSize: '15px', color: s.done ? '#aaa' : '#5a3e2b' }}>{s.name}</p>
                      {s.done && <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>실제 {fmt(s.elapsedSeconds??0)} 소요</p>}
                    </div>
                  </div>
                  <span style={{ fontWeight: '900', fontSize: '22px', color: s.done ? '#ccc' : '#c47a3a' }}>{fmt(s.timeLeft)}</span>
                </div>
                {!s.done && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => toggle(s.id)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: s.running ? '#fde8c8' : '#f9c88a', color: s.running ? '#c47a3a' : '#fff', fontWeight: '800', fontSize: '14px', cursor: 'pointer', fontFamily: font }}>
                      {s.running ? '⏸️ 일시정지' : '▶️ 시작'}
                    </button>
                    <button onClick={() => completeStep(s.id)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: '#ffd6e0', color: '#c0446a', fontWeight: '800', fontSize: '14px', cursor: 'pointer', fontFamily: font }}>
                      ✅ 완료
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

{/* 순차 진행 완료 결과 배너 */}
          {showSeqResult && (
            <div style={{ background: 'linear-gradient(135deg, #e8f4fd, #ddeeff)', borderRadius: '20px', padding: '24px 20px', marginBottom: '12px', textAlign: 'center', boxShadow: '0 4px 20px rgba(120,180,249,0.3)', position: 'relative' }}>
              <button
                onClick={() => setShowSeqResult(false)}
                style={{ position: 'absolute', top: '12px', right: '14px', border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#4a7ac4' }}>✕</button>
              <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: '#6a9ad4' }}>📋 순차 진행 완료!</p>
              <p style={{ margin: '0 0 4px', fontSize: '48px', fontWeight: '900', color: '#4a7ac4', letterSpacing: '-1px' }}>
                {fmt(steps.filter(s => !s.parallel).reduce((a, s) => a + (s.elapsedSeconds ?? 0), 0))}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#6a9ad4' }}>총 소요 시간 🏅</p>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                {steps.filter(s => !s.parallel).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#f0f8ff', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>{s.emoji} {s.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#4a7ac4' }}>{fmt(s.elapsedSeconds ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 순차 진행 */}
          <div style={card}>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>📋</span>
              <span style={{ fontWeight: '900', fontSize: '15px', color: '#c47a3a' }}>순차 진행</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {/* ▶️ 시작 */}
                {steps.filter(s => !s.parallel).some(s => !s.running && !s.done) && (
                  <button
                    onClick={() => {
                      setSteps(prev => {
                        const firstNotDone = prev.find(s => !s.parallel && !s.done)
                        if (!firstNotDone) return prev
                        return prev.map(s =>
                          s.id === firstNotDone.id ? { ...s, running: true } : !s.parallel ? { ...s, running: false } : s
                        )
                      })
                      if (!started) setStarted(true)
                    }}
                    style={{ padding: '10px 16px', borderRadius: '12px', border: 'none', background: '#f9c88a', color: '#fff', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: font }}>
                    ▶️ 시작
                  </button>
                )}
                {/* ✅ 완료 */}
                {steps.filter(s => !s.parallel).some(s => !s.done) && (
                  <button
                    onClick={() => {
                      setSteps(prev => {
                        const updated = prev.map(s =>
                          !s.parallel
                            ? { ...s, running: false, done: true, elapsedSeconds: s.elapsedSeconds ?? 0 }
                            : s
                        )
                        setShowSeqResult(true)
                        // 자동 중간 저장
                        setTimeout(() => {
                          saveProgress({
                            projectName,
                            steps: updated.map(s => ({ ...s, running: false })),
                            limitLeft,
                            savedAt: fmtDate(new Date())
                          })
                          setProgList(loadProgressList())
                        }, 100)
                        return updated
                      })
                    }}
                    style={{ padding: '10px 16px', borderRadius: '12px', border: 'none', background: '#ffd6e0', color: '#c0446a', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: font }}>
                    ✅ 완료
                  </button>
                )}
              </div>
            </div>
            {steps.filter(s => !s.parallel).map(s => (
              <div key={s.id} style={{ background: s.done ? '#f5f5f5' : s.running ? '#fff8f0' : '#fffaf5', borderRadius: '16px', padding: '14px', marginBottom: '8px', border: `2px solid ${s.done ? '#eee' : s.running ? '#f9c88a' : '#fde8c8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.done ? 0 : '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>{s.done ? '✅' : s.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: '800', fontSize: '15px', color: s.done ? '#aaa' : '#5a3e2b' }}>{s.name}</p>
                      {s.done && <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>실제 {fmt(s.elapsedSeconds??0)} 소요</p>}
                    </div>
                  </div>
                  <span style={{ fontWeight: '900', fontSize: '22px', color: s.done ? '#ccc' : '#c47a3a' }}>{fmt(s.timeLeft)}</span>
                </div>
                {!s.done && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => toggle(s.id)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: s.running ? '#fde8c8' : '#f9c88a', color: s.running ? '#c47a3a' : '#fff', fontWeight: '800', fontSize: '14px', cursor: 'pointer', fontFamily: font }}>
                      {s.running ? '⏸️ 일시정지' : '▶️ 시작'}
                    </button>
                    <button onClick={() => completeStep(s.id)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: '#ffd6e0', color: '#c0446a', fontWeight: '800', fontSize: '14px', cursor: 'pointer', fontFamily: font }}>
                      ✅ 완료
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>}

        {/* 기록 탭 */}
        {page === 'history' && (
          <div style={card}>
            <p style={{ fontWeight: '900', fontSize: '16px', color: '#c47a3a', marginBottom: '12px' }}>📊 완료된 프로젝트 기록</p>
            {projects.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#bbb', fontSize: '15px', padding: '20px 0' }}>아직 완료된 프로젝트가 없어요 🪑</p>
            ) : projects.slice().reverse().map((p, i) => (
              <div key={p.id} style={{ background: '#fffaf5', borderRadius: '16px', padding: '14px', marginBottom: '10px', border: '2px solid #fde8c8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: '900', fontSize: '15px', color: '#c47a3a' }}>{p.name || `#${projects.length - i}`}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#bbb' }}>{p.date}</p>
                  </div>
                  <button onClick={() => handleDeleteProject(p.id)} style={{ border: 'none', background: '#ffe0e0', color: '#e07070', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>삭제</button>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#888' }}>⏱ 총 소요: <strong style={{ color: '#c47a3a' }}>{fmt(p.totalSeconds)}</strong></p>
                {p.steps.map((s, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f5e8d8' }}>
                    <span style={{ fontSize: '13px', color: '#888' }}>{s.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#c47a3a' }}>{fmt(s.elapsedSeconds)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}