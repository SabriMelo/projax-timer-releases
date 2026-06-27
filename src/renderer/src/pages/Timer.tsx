import { useEffect, useRef, useState } from 'react'
import { MonitorCheck, Wifi, WifiOff, Bug, X } from 'lucide-react'
import { useStore, TrackSession } from '../store/useStore'
import { apiRequest } from '../lib/api'

function pad(n: number) { return String(n).padStart(2, '0') }
function formatSec(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

const APP_COLORS: Record<string, string> = {
  AutoCAD:     'bg-red-50 border-red-200 text-red-600',
  Revit:       'bg-amber-50 border-amber-200 text-amber-700',
  SketchUp:    'bg-orange-50 border-orange-200 text-orange-600',
  ArchiCAD:    'bg-rose-50 border-rose-200 text-rose-600',
  Rhino:       'bg-stone-50 border-stone-200 text-stone-600',
  Vectorworks: 'bg-emerald-50 border-emerald-200 text-emerald-600',
  BricsCAD:    'bg-yellow-50 border-yellow-200 text-yellow-700',
  ZWCAD:       'bg-teal-50 border-teal-200 text-teal-600',
}

// ── SessionCard ───────────────────────────────────────────────────────────────
function SessionCard({ session }: { session: TrackSession }) {
  const { projects, getSessionSeconds } = useStore()
  const [seconds, setSeconds] = useState(() => getSessionSeconds(session.fileName))
  const selectedProject = projects.find(p => p.id === session.projectId)
  const appStyle = APP_COLORS[session.app] ?? 'bg-stone-50 border-stone-200 text-stone-600'

  useEffect(() => {
    const t = setInterval(() => setSeconds(getSessionSeconds(session.fileName)), 1000)
    return () => clearInterval(t)
  }, [session.fileName])

  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm space-y-2.5 transition-all
      ${session.running ? 'border-brand/20' : 'border-sand-md opacity-60'}`}>

      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${appStyle}`}>
          {session.app}
        </span>
        <p className="text-[11px] text-gray-400 font-mono truncate flex-1" title={session.fileName}>
          {session.fileName}
        </p>
        {session.running
          ? <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              gravando
            </span>
          : <span className="text-[10px] text-amber-500 shrink-0">pausado</span>
        }
      </div>

      {selectedProject ? (
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] text-gray-400 shrink-0">{selectedProject.code}</span>
          <span className="text-sm font-bold text-gray-800 truncate">{selectedProject.name}</span>
          {session.parsed.category && (
            <span className="ml-auto text-[10px] bg-brand/10 text-brand rounded-md px-2 py-0.5 shrink-0 font-medium">
              {session.parsed.category}
            </span>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-amber-600">
          {session.parsed.code
            ? `Código "${session.parsed.code}" não encontrado (${projects.length} projeto${projects.length !== 1 ? 's' : ''} carregado${projects.length !== 1 ? 's' : ''})`
            : 'Código não identificado — verifique Config.'}
        </p>
      )}

      <p className={`text-3xl font-mono font-bold tracking-tight
        ${session.running ? 'text-gray-900' : 'text-gray-400'}`}>
        {formatSec(seconds)}
      </p>
    </div>
  )
}

// ── Diagnóstico ───────────────────────────────────────────────────────────────
type DiagResult = {
  files: { fileName: string; app: string; active: boolean }[]
  procs: { name: string; title: string; matchedApp: string | null; detectedFile: string | null; foreground: boolean }[]
  error: string | null
}

function DiagPanel({ onClose }: { onClose: () => void }) {
  const { projects, namingConfig } = useStore()
  const [result, setResult] = useState<DiagResult | null>(null)
  const [loading, setLoading] = useState(false)
  const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const run = async () => {
    setLoading(true)
    const r = await window.electronAPI.diagnose()
    setResult(r as DiagResult)
    setLoading(false)
  }

  return (
    <div className="absolute inset-0 z-30 bg-sand flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-sand-md bg-white/60">
        <span className="text-sm font-semibold text-gray-800">Diagnóstico</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-sand text-gray-400"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <div>
          <p className="font-semibold text-gray-700 mb-1">Projetos ({projects.length})</p>
          {projects.length === 0
            ? <p className="text-red-500">Nenhum projeto. Verifique conexão com servidor.</p>
            : projects.map(p => (
              <div key={p.id} className="flex gap-2 py-0.5 text-gray-600">
                <span className="font-mono text-gray-400 w-28 shrink-0">{p.code}</span>
                <span className="font-mono text-brand w-20 shrink-0">{normalize(p.code)}</span>
                <span className="truncate">{p.name}</span>
              </div>
            ))}
        </div>
        <div>
          <p className="font-semibold text-gray-700 mb-1">Config</p>
          <p className="text-gray-500">
            Separador: <span className="font-mono bg-sand px-1">"{namingConfig.separator}"</span> ·
            Código pos {namingConfig.codePosition} ·
            Cliente pos {namingConfig.clientPosition ?? '—'} ·
            Categoria pos {namingConfig.categoryPosition ?? '—'}
          </p>
        </div>
        <button onClick={run} disabled={loading}
          className="w-full h-9 bg-brand text-white rounded-xl text-xs font-medium hover:bg-brand-dk disabled:opacity-50 transition">
          {loading ? 'Analisando...' : 'Analisar agora'}
        </button>
        {result && <>
          {result.error && <p className="text-red-600 bg-red-50 p-2 rounded-lg">Erro: {result.error}</p>}
          <div>
            <p className="font-semibold text-gray-700 mb-1">Apps detectados ({result.procs.length})</p>
            {result.procs.length === 0
              ? <p className="text-amber-600 bg-amber-50 p-2 rounded-lg">Nenhum app de arquitetura detectado.</p>
              : result.procs.map((p, i) => (
                <div key={i} className="border border-sand-md rounded-lg p-2 mb-1.5 space-y-0.5 bg-white">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.matchedApp}</p>
                    {p.foreground && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 rounded-full">em foco</span>}
                  </div>
                  <p className="text-gray-500 truncate">Título: {p.title}</p>
                  {p.detectedFile
                    ? <p className="text-green-600">Arquivo: <span className="font-mono">{p.detectedFile}</span></p>
                    : <p className="text-red-500">Arquivo não extraído do título</p>}
                </div>
              ))}
          </div>
          {result.files.length > 0 && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Match com projetos</p>
              {result.files.map((f, i) => {
                const parts = f.fileName.replace(/\.[^/.]+$/, '').split(namingConfig.separator)
                const code = parts[namingConfig.codePosition]?.trim().toUpperCase() ?? ''
                const matched = projects.find(p => {
                  const pn = normalize(p.code), fn = normalize(code)
                  return pn === fn || pn.endsWith(fn)
                })
                return (
                  <div key={i} className="border border-sand-md rounded-lg p-2 mb-1.5 bg-white">
                    <p className="font-mono text-gray-700">{f.fileName}</p>
                    <p className="text-gray-500">Código: <span className="font-mono">{code || '—'}</span> → <span className="font-mono">{normalize(code)}</span></p>
                    {matched
                      ? <p className="text-green-600">Match: {matched.code} — {matched.name}</p>
                      : <p className="text-red-500">Sem match para "{code}"</p>}
                  </div>
                )
              })}
            </div>
          )}
        </>}
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; ok: boolean }

// ── Constantes de tempo ────────────────────────────────────────────────────────
const BACKGROUND_PAUSE_MS = 5 * 60 * 1000
const IDLE_PAUSE_SEC = 300

// ── Página Timer ──────────────────────────────────────────────────────────────
export default function Timer() {
  const {
    token, sessions,
    upsertSession, pauseSession, startSession, removeSession, addEntry,
    pauseAllSessions, resumeSessions, subtractSeconds, getSessionSeconds, recheckSessions,
  } = useStore()

  const [detecting, setDetecting] = useState(false)
  const [showDiag, setShowDiag] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  const lastForegroundTime = useRef<Record<string, number>>({})
  const prevFileNames = useRef<Set<string>>(new Set())
  const wasIdle = useRef(false)
  const idlePausedSessions = useRef<string[]>([])
  const idleSecsRef = useRef(0)

  const addToast = (message: string, ok = true) => {
    const id = ++toastId.current
    setToasts(t => [...t, { id, message, ok }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  const autoSave = async (fileName: string) => {
    pauseSession(fileName)
    await new Promise(r => setTimeout(r, 50))

    const session = useStore.getState().sessions[fileName]
    if (!session || !session.projectId || !token) { removeSession(fileName); return }

    const minutes = Math.round(session.elapsedSeconds / 60)
    if (minutes < 1) { removeSession(fileName); return }

    try {
      const cat = session.parsed.category ? ` · ${session.parsed.category}` : ''
      const { entry } = await apiRequest('/api/timer/entries', {
        method: 'POST', token,
        body: {
          project_id: session.projectId,
          minutes,
          description: `${session.app}${cat}: ${fileName}`,
          date: new Date().toISOString(),
        },
      })
      addEntry(entry)
      removeSession(fileName)
      const proj = useStore.getState().projects.find(p => p.id === session.projectId)
      addToast(`Salvo ${minutes} min — ${proj?.code ?? ''}${cat}`)
    } catch {
      removeSession(fileName)
      addToast(`Erro ao salvar ${fileName}`, false)
    }
  }

  const sendHeartbeat = async (clear = false) => {
    const state = useStore.getState()
    if (!state.token) return
    const running = clear ? null : Object.values(state.sessions).find(s => s.running && s.projectId)
    await apiRequest('/api/timer/heartbeat', {
      method: 'POST',
      token: state.token,
      body: {
        project_id: running?.projectId ?? null,
        elapsed_seconds: running ? state.getSessionSeconds(running.fileName) : 0,
      },
    }).catch(() => {})
  }

  useEffect(() => {
    window.electronAPI.startDetection()
    setDetecting(true)

    sendHeartbeat()
    const heartbeatInterval = setInterval(() => sendHeartbeat(), 60_000)

    const cleanupFiles = window.electronAPI.onFilesDetected((files) => {
      const now = Date.now()
      const currentNames = new Set(files.map(f => f.fileName))

      for (const file of files) {
        upsertSession(file)
        if (file.active) {
          const lastSeen = lastForegroundTime.current[file.fileName]
          lastForegroundTime.current[file.fileName] = now
          if (!wasIdle.current) {
            const s = useStore.getState().sessions[file.fileName]
            if (s && !s.running) startSession(file.fileName)
          }
        } else {
          const lastSeen = lastForegroundTime.current[file.fileName]
          if (lastSeen === undefined) {
            lastForegroundTime.current[file.fileName] = now
          } else if (now - lastSeen >= BACKGROUND_PAUSE_MS) {
            const s = useStore.getState().sessions[file.fileName]
            if (s && s.running) {
              const absentSeconds = Math.floor((now - lastSeen) / 1000)
              pauseSession(file.fileName)
              subtractSeconds([file.fileName], absentSeconds)
            }
          }
        }
      }

      for (const prevName of prevFileNames.current) {
        if (!currentNames.has(prevName)) {
          autoSave(prevName)
          delete lastForegroundTime.current[prevName]
        }
      }

      prevFileNames.current = currentNames
    })

    const cleanupIdle = window.electronAPI.onIdleUpdate((idleTime) => {
      if (idleTime >= IDLE_PAUSE_SEC && !wasIdle.current) {
        wasIdle.current = true
        idleSecsRef.current = idleTime
        idlePausedSessions.current = pauseAllSessions()
      }
      if (idleTime < 30 && wasIdle.current) {
        wasIdle.current = false
        if (idlePausedSessions.current.length > 0) {
          subtractSeconds(idlePausedSessions.current, idleSecsRef.current)
          resumeSessions(idlePausedSessions.current)
          const now = Date.now()
          for (const fn of idlePausedSessions.current) {
            lastForegroundTime.current[fn] = now
          }
          idlePausedSessions.current = []
        }
      }
    })

    return () => {
      window.electronAPI.stopDetection()
      cleanupFiles()
      cleanupIdle()
      clearInterval(heartbeatInterval)
      sendHeartbeat(true)
    }
  }, [])

  const sessionList = Object.values(sessions)

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {showDiag && <DiagPanel onClose={() => setShowDiag(false)} />}

      {/* Toasts */}
      <div className="absolute bottom-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-xl px-4 py-2.5 text-xs font-medium shadow-lg text-white
            ${t.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className={`flex items-center gap-2 px-5 py-2.5 border-b shrink-0
        ${detecting ? 'bg-emerald-50 border-emerald-100' : 'bg-sand border-sand-md'}`}>
        {detecting
          ? <><Wifi size={12} className="text-emerald-500" /><span className="text-[11px] text-emerald-600 font-medium">Monitorando automaticamente</span></>
          : <><WifiOff size={12} className="text-gray-400" /><span className="text-[11px] text-gray-400">Detecção pausada</span></>}
        <button onClick={() => setShowDiag(true)} title="Diagnóstico"
          className="ml-auto p-1 rounded hover:bg-sand-md text-gray-300 hover:text-gray-500 transition">
          <Bug size={12} />
        </button>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {sessionList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <MonitorCheck size={40} className="opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">Nenhum arquivo detectado</p>
              <p className="text-xs mt-1 leading-relaxed text-gray-400">
                Abra um arquivo no AutoCAD, Revit,<br />SketchUp, ArchiCAD ou Rhino
              </p>
              <button onClick={() => setShowDiag(true)}
                className="mt-3 text-[11px] text-brand hover:underline">
                Executar diagnóstico
              </button>
            </div>
          </div>
        ) : (
          sessionList.map(session => (
            <SessionCard key={session.fileName} session={session} />
          ))
        )}
      </div>
    </div>
  )
}
