import { useEffect, useState } from 'react'
import { Clock, RefreshCw } from 'lucide-react'
import { useStore, TimeEntry } from '../store/useStore'
import { apiRequest } from '../lib/api'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtMinutes(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}min`
  return min > 0 ? `${h}h ${min}min` : `${h}h`
}

function groupByDate(entries: TimeEntry[]) {
  const map = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    const key = entry.date.split('T')[0]
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }
  return map
}

export default function History() {
  const { token, entries, setEntries } = useStore()
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!token) return
    setLoading(true)
    try {
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const { entries: data } = await apiRequest(
        `/api/timer/entries?from=${from.toISOString()}`,
        { token }
      )
      setEntries(data)
    } catch { /* keep existing */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const grouped = groupByDate(entries)
  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0)

  const projectTotals = entries.reduce((acc: Record<string, { name: string; code: string; minutes: number }>, e) => {
    const key = e.project_id
    if (!acc[key]) acc[key] = { name: e.project.name, code: e.project.code, minutes: 0 }
    acc[key].minutes += e.minutes
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-sand-md flex items-center justify-between shrink-0 bg-white/60">
        <div>
          <p className="text-xs text-gray-400">Últimos 30 dias</p>
          <p className="text-lg font-bold text-gray-900">{fmtMinutes(totalMinutes)} registrados</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl hover:bg-sand text-gray-400 hover:text-gray-600 transition disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Resumo por projeto */}
      {Object.keys(projectTotals).length > 0 && (
        <div className="px-5 py-3 border-b border-sand-md shrink-0 bg-white/40">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Por projeto</p>
          <div className="space-y-1.5">
            {Object.values(projectTotals)
              .sort((a, b) => b.minutes - a.minutes)
              .map((p, i) => {
                const pct = totalMinutes > 0 ? (p.minutes / totalMinutes) * 100 : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-gray-600 truncate max-w-[200px]">
                        <span className="font-mono text-gray-400 mr-1">{p.code}</span>{p.name}
                      </span>
                      <span className="text-gray-500 font-medium shrink-0 ml-2">{fmtMinutes(p.minutes)}</span>
                    </div>
                    <div className="w-full h-1 bg-sand-md rounded-full overflow-hidden">
                      <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <Clock size={32} className="opacity-30" />
            <p className="text-sm">Nenhum registro nos últimos 30 dias</p>
          </div>
        ) : (
          <div className="px-5 py-3 space-y-4">
            {Array.from(grouped.entries()).map(([date, dayEntries]) => {
              const dayTotal = dayEntries.reduce((s, e) => s + e.minutes, 0)
              return (
                <div key={date}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500">{fmtDate(date)}</p>
                    <p className="text-xs text-gray-400">{fmtMinutes(dayTotal)}</p>
                  </div>
                  <div className="space-y-1.5">
                    {dayEntries.map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 bg-white border border-sand-md rounded-xl px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                          <Clock size={13} className="text-brand" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">
                            <span className="font-mono text-gray-400 mr-1">{entry.project.code}</span>
                            {entry.project.name}
                          </p>
                          {entry.description && (
                            <p className="text-[11px] text-gray-400 truncate">{entry.description}</p>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-gray-700 shrink-0">{fmtMinutes(entry.minutes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
