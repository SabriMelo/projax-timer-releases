import { useEffect, useState } from 'react'
import { Maximize2, Minus } from 'lucide-react'
import { useStore } from '../store/useStore'

function pad(n: number) { return String(n).padStart(2, '0') }
function formatSec(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

interface WidgetProps {
  onExpand: () => void
}

export default function Widget({ onExpand }: WidgetProps) {
  const { sessions, projects, getSessionSeconds } = useStore()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const running = Object.values(sessions).find(s => s.running && s.projectId)
    ?? Object.values(sessions).find(s => s.running)

  const project = running?.projectId ? projects.find(p => p.id === running.projectId) : null
  const seconds = running ? getSessionSeconds(running.fileName) : 0

  return (
    <div
      className="h-screen w-screen bg-white border border-[#EDE8E2] rounded-2xl overflow-hidden flex flex-col select-none shadow-2xl"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${running ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
          <span className="text-[10px] font-semibold text-gray-500 tracking-wide">
            {running ? 'Gravando' : 'Monitorando'}
          </span>
        </div>
        <div
          className="flex items-center gap-0.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={onExpand}
            className="p-1 rounded-lg hover:bg-[#F7F3EE] text-gray-400 hover:text-gray-600 transition"
            title="Expandir"
          >
            <Maximize2 size={11} />
          </button>
          <button
            onClick={() => window.electronAPI.minimizeWindow()}
            className="p-1 rounded-lg hover:bg-[#F7F3EE] text-gray-400 hover:text-gray-600 transition"
            title="Minimizar"
          >
            <Minus size={11} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-3 pb-2.5 flex flex-col justify-center gap-0.5">
        {running ? (
          <>
            <div className="flex items-baseline gap-2">
              {project ? (
                <>
                  <span className="text-[10px] font-mono text-[#C26330]">{project.code}</span>
                  <span className="text-xs font-semibold text-gray-800 truncate flex-1">{project.name}</span>
                </>
              ) : (
                <span className="text-xs text-amber-600 truncate flex-1">{running.fileName}</span>
              )}
              <span className="text-sm font-mono font-bold text-gray-900 shrink-0 tabular-nums">
                {formatSec(seconds)}
              </span>
            </div>
            {project && (
              <p className="text-[10px] text-gray-400 font-mono truncate">{running.fileName}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400">Nenhum arquivo detectado</p>
        )}
      </div>
    </div>
  )
}
