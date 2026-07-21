import { useState, useEffect } from 'react'
import { Clock, History, LogOut, RefreshCw, Settings2, AlertCircle, Minus, Maximize2, X, Download, RotateCw } from 'lucide-react'

const LOGO_PATH = "M926.508 485.556C1091.66 485.556 1249.32 540.28 1366.29 649.119C1484.01 758.661 1556.01 918.889 1556.01 1120.35H1430.01C1430.01 1069.8 1424.71 1023.16 1414.89 980.372L1160.41 1120.27H1429.8V1246.27H931.209L926.625 1248.79V1730.46L800.625 1730.46V611.388H926.508V485.556ZM994.331 1067.78L1371.18 860.618C1346.88 814.173 1316.03 774.461 1280.46 741.362C1246.79 710.034 1208.27 684.057 1166.09 663.782L994.331 1067.78ZM926.625 904.992L1046.26 623.596C1007.88 615.639 967.797 611.564 926.625 611.557V904.992Z"
import { useStore } from './store/useStore'
import { supabase } from './lib/supabase'
import { apiRequest } from './lib/api'
import Login from './pages/Login'
import Timer from './pages/Timer'
import HistoryPage from './pages/History'
import SettingsPage from './pages/Settings'

type Tab = 'timer' | 'history' | 'settings'

async function getFreshToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'downloaded'; version: string }

function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const cleanupAvailable = window.electronAPI.onUpdateAvailable(({ version }) => {
      setDismissed(false)
      setUpdate({ phase: 'available', version })
    })
    const cleanupProgress = window.electronAPI.onUpdateProgress(({ percent }) => {
      setUpdate({ phase: 'downloading', percent })
    })
    const cleanupDownloaded = window.electronAPI.onUpdateDownloaded(({ version }) => {
      setDismissed(false)
      setUpdate({ phase: 'downloaded', version })
    })
    return () => { cleanupAvailable(); cleanupProgress(); cleanupDownloaded() }
  }, [])

  if (update.phase === 'idle' || dismissed) return null

  return (
    <div className="px-4 py-2 bg-brand/10 border-b border-brand/20 flex items-center gap-2">
      {update.phase === 'downloaded'
        ? <RotateCw size={12} className="text-brand shrink-0" />
        : <Download size={12} className="text-brand shrink-0" />}

      <p className="text-[11px] text-brand-dk flex-1">
        {update.phase === 'available' && `Nova versão ${update.version} disponível.`}
        {update.phase === 'downloading' && `Baixando atualização... ${Math.round(update.percent)}%`}
        {update.phase === 'downloaded' && `Versão ${update.version} pronta — reinicie para instalar.`}
      </p>

      {update.phase === 'available' && (
        <button
          onClick={() => window.electronAPI.downloadUpdate()}
          className="text-[11px] text-brand font-semibold hover:underline shrink-0"
        >
          Baixar
        </button>
      )}
      {update.phase === 'downloaded' && (
        <button
          onClick={() => window.electronAPI.installUpdate()}
          className="text-[11px] text-brand font-semibold hover:underline shrink-0"
        >
          Reiniciar agora
        </button>
      )}
      <button onClick={() => setDismissed(true)} className="p-0.5 rounded hover:bg-brand/10 text-brand/60 shrink-0">
        <X size={12} />
      </button>
    </div>
  )
}

export default function App() {
  const { token, userName, userRole, setAuth, clearAuth, setProjects, setRole, recheckSessions } = useStore()
  const [tab, setTab] = useState<Tab>('timer')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)

  const loadProjects = async (accessToken: string) => {
    setLoadingProjects(true)
    setProjectError(null)
    try {
      const { projects, role } = await apiRequest('/api/timer/projetos', { token: accessToken })
      setProjects(projects)
      if (role) setRole(role)
      recheckSessions()
    } catch (e: any) {
      const msg = e.message ?? ''
      if (msg.includes('autenticado') || msg.includes('401') || msg.includes('403') || msg.includes('planos pagos') || msg.includes('plano')) {
        // Token inválido ou plano não permite Timer → logout
        await supabase.auth.signOut()
        clearAuth()
      } else {
        setProjectError(msg || 'Erro ao carregar projetos')
      }
    } finally {
      setLoadingProjects(false)
    }
  }

  useEffect(() => {
    if (!token) return
    getFreshToken().then(freshToken => {
      if (!freshToken) { clearAuth(); return }
      if (freshToken !== token) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            const name = session.user.user_metadata?.name || session.user.email || 'Usuário'
            setAuth(freshToken, name)
          }
        })
      }
      loadProjects(freshToken)
    })
  }, [token])

  useEffect(() => {
    if (!token) return
    const interval = setInterval(async () => {
      const freshToken = await getFreshToken()
      if (!freshToken) { clearAuth(); return }
      if (freshToken !== token) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) setAuth(freshToken, session.user.user_metadata?.name || session.user.email || userName || '')
        })
      }
    }, 45 * 60 * 1000)
    return () => clearInterval(interval)
  }, [token])

  if (!token) return <Login />

  return (
    <div className="flex flex-col h-screen bg-sand select-none rounded-2xl overflow-hidden shadow-2xl">

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-sand-md shrink-0 bg-white/70 backdrop-blur-sm"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2.5">
          <svg viewBox="553 483 1250 1250" width="24" height="24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path d={LOGO_PATH} fill="#c05a2e"/>
          </svg>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Projax Timer</p>
            <p className="text-[10px] text-gray-400 leading-tight">{userName}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-0.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {loadingProjects && <RefreshCw size={12} className="text-gray-300 animate-spin mr-1" />}
          {projectError && (
            <button onClick={() => getFreshToken().then(t => t && loadProjects(t))} title={projectError}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition">
              <AlertCircle size={13} />
            </button>
          )}
          <div className="w-px h-4 bg-sand-md mx-1" />
          <button onClick={() => window.electronAPI.minimizeWindow()}
            className="p-1.5 rounded-lg hover:bg-sand text-gray-400 hover:text-gray-600 transition">
            <Minus size={13} />
          </button>
          <button onClick={() => window.electronAPI.maximizeWindow()}
            className="p-1.5 rounded-lg hover:bg-sand text-gray-400 hover:text-gray-600 transition">
            <Maximize2 size={13} />
          </button>
          <button onClick={() => window.electronAPI.closeWindow()}
            className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition">
            <X size={13} />
          </button>
        </div>
      </div>

      <UpdateBanner />

      {/* Erro de projetos */}
      {projectError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
          <AlertCircle size={12} className="text-red-400 shrink-0" />
          <p className="text-[11px] text-red-600 flex-1">{projectError}</p>
          <button
            onClick={() => getFreshToken().then(t => t && loadProjects(t))}
            className="text-[11px] text-red-500 font-medium hover:underline shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'timer' ? <Timer /> : tab === 'history' ? <HistoryPage /> : <SettingsPage />}
      </div>

      {/* Bottom nav */}
      <div className="flex border-t border-sand-md shrink-0 bg-white/70 backdrop-blur-sm">
        {([
          { id: 'timer',    icon: Clock,     label: 'Timer'     },
          { id: 'history',  icon: History,   label: 'Histórico' },
          ...(userRole !== 'COLLABORATOR' ? [{ id: 'settings' as const, icon: Settings2, label: 'Config.' }] : []),
        ] as const).map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition
              ${tab === id
                ? 'text-brand border-t-2 border-brand -mt-px'
                : 'text-gray-400 hover:text-gray-600'}`}>
            <Icon size={18} />
            {label}
          </button>
        ))}
        <button onClick={clearAuth}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium text-gray-400 hover:text-red-400 transition">
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </div>
  )
}
