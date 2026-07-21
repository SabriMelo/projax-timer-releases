import { useState, useEffect } from 'react'
import { Settings2, Plus, Trash2, ChevronDown, Check, AlertCircle } from 'lucide-react'
import { useStore, NamingConfig, CategoryMapping } from '../store/useStore'
import { apiRequest } from '../lib/api'

const SEPARATORS = [
  { value: '_', label: 'Underline  _' },
  { value: '-', label: 'Hífen  -' },
  { value: ' ', label: 'Espaço' },
  { value: '.', label: 'Ponto  .' },
]

const POSITION_OPTIONS = [
  { value: 0, label: '1ª parte' },
  { value: 1, label: '2ª parte' },
  { value: 2, label: '3ª parte' },
  { value: 3, label: '4ª parte' },
  { value: 4, label: '5ª parte' },
]

function Select({
  value, onChange, options, placeholder,
}: {
  value: string | number | null
  onChange: (v: any) => void
  options: { value: any; label: string }[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full h-9 border border-sand-md rounded-xl px-3 pr-8 text-xs text-left flex items-center bg-white hover:border-gray-300 transition focus:outline-none"
      >
        {selected ? selected.label : <span className="text-gray-400">{placeholder ?? 'Selecionar'}</span>}
        <ChevronDown size={12} className={`absolute right-2.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-sand-md rounded-xl shadow-lg overflow-hidden">
          {placeholder && (
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-sand transition"
            >
              {placeholder}
            </button>
          )}
          {options.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-sand transition flex items-center justify-between
                ${value === opt.value ? 'bg-brand/5 text-brand font-medium' : 'text-gray-700'}`}
            >
              {opt.label}
              {value === opt.value && <Check size={11} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const PREVIEW_PARTS = ['001', 'marc', 'NomeCliente', 'PB', 'V1']

function NamingPreview({ config }: { config: NamingConfig }) {
  const sep = config.separator

  const roleOf = (i: number): 'code' | 'client' | 'category' | null => {
    if (i === config.codePosition) return 'code'
    if (config.clientPosition !== null && i === config.clientPosition) return 'client'
    if (config.categoryPosition !== null && i === config.categoryPosition) return 'category'
    return null
  }

  const roleStyle = {
    code:     { chip: 'bg-brand/10 border-brand/30 text-brand',          label: 'código'    },
    client:   { chip: 'bg-purple-50 border-purple-200 text-purple-600',   label: 'cliente'   },
    category: { chip: 'bg-amber-50 border-amber-200 text-amber-700',      label: 'categoria' },
  }

  // Resumo na ordem real do arquivo
  const summary = PREVIEW_PARTS.map((part, i) => {
    const role = roleOf(i)
    if (!role) return null
    if (role === 'code') return `Código: ${part}`
    if (role === 'client') return `Cliente: ${part}`
    if (role === 'category') {
      const raw = part.toUpperCase()
      const resolved = config.categoryMappings.find(m => m.keyword.toUpperCase() === raw)?.label ?? raw
      return `Categoria: ${resolved}`
    }
    return null
  }).filter(Boolean).join('  ·  ')

  // Nome do arquivo de exemplo montado com o separador escolhido
  const exampleName = PREVIEW_PARTS.join(sep === ' ' ? ' ' : sep) + '.dwg'

  return (
    <div className="bg-white border border-sand-md rounded-xl p-3 space-y-2.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Prévia</p>

      {/* Nome do arquivo */}
      <p className="text-[11px] font-mono text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100 truncate">
        {exampleName}
      </p>

      {/* Chips das partes */}
      <div className="flex items-start gap-1 flex-wrap">
        {PREVIEW_PARTS.map((part, i) => {
          const role = roleOf(i)
          const style = role ? roleStyle[role] : null
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className="flex items-center">
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border
                  ${style ? style.chip : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {part}
                </span>
                {i < PREVIEW_PARTS.length - 1 && (
                  <span className="text-[10px] text-gray-300 px-0.5 font-mono">
                    {sep === ' ' ? '·' : sep}
                  </span>
                )}
              </div>
              {style && (
                <span className="text-[9px] font-semibold leading-none mt-0.5" style={{
                  color: role === 'code' ? '#C26330' : role === 'client' ? '#9333ea' : '#b45309'
                }}>
                  {style.label}
                </span>
              )}
            </div>
          )
        })}
        <span className="text-[10px] text-gray-400 self-start mt-1 font-mono">.dwg</span>
      </div>

      {/* Resultado na ordem do arquivo */}
      <p className="text-[11px] text-brand font-medium">{summary || '—'}</p>
    </div>
  )
}

export default function Settings() {
  const { token, namingConfig, setNamingConfig } = useStore()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [newKw, setNewKw] = useState('')
  const [newLbl, setNewLbl] = useState('')
  const [mappingAdded, setMappingAdded] = useState(false)

  // Carrega a config salva no servidor (compartilhada pelo escritório) ao abrir a tela
  useEffect(() => {
    if (!token) return
    setLoadingRemote(true)
    apiRequest('/api/timer/naming-config', { token })
      .then(({ config }) => {
        if (config) setNamingConfig({ ...config, configured: true })
      })
      .catch(() => {})
      .finally(() => setLoadingRemote(false))
  }, [token])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const { separator, codePosition, clientPosition, categoryPosition, categoryMappings } = namingConfig
      await apiRequest('/api/timer/naming-config', {
        method: 'PUT',
        token: token!,
        body: { separator, codePosition, clientPosition, categoryPosition, categoryMappings },
      })
      setNamingConfig({ configured: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setSaveError(e.message ?? 'Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  const addMapping = () => {
    const kw = newKw.trim().toUpperCase()
    const lbl = newLbl.trim()
    if (!kw || !lbl) return
    if (namingConfig.categoryMappings.some(m => m.keyword.toUpperCase() === kw)) return
    setNamingConfig({
      categoryMappings: [...namingConfig.categoryMappings, { keyword: kw, label: lbl }],
    })
    setNewKw('')
    setNewLbl('')
    setMappingAdded(true)
    setTimeout(() => setMappingAdded(false), 2000)
  }

  const removeMapping = (keyword: string) => {
    setNamingConfig({
      categoryMappings: namingConfig.categoryMappings.filter(m => m.keyword !== keyword),
    })
  }

  const inputCls = 'h-8 border border-sand-md rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white transition'

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-sand-md shrink-0 bg-white/60">
        <Settings2 size={14} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-800">Padrão de nomenclatura</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Intro */}
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Configure como os arquivos do seu escritório são nomeados. O app usará isso para
          identificar automaticamente o projeto, cliente e tipo de arquivo.
        </p>

        {/* Preview */}
        <NamingPreview config={namingConfig} />

        {/* Separator */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700">Separador</label>
          <Select
            value={namingConfig.separator}
            onChange={v => setNamingConfig({ separator: v })}
            options={SEPARATORS}
          />
        </div>

        {/* Positions */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-700">Posição das partes</p>
          <div className="space-y-2">
            {[
              { label: 'Código do projeto', key: 'codePosition',     nullable: false },
              { label: 'Nome do cliente',   key: 'clientPosition',   nullable: true  },
              { label: 'Categoria',         key: 'categoryPosition', nullable: true  },
            ].map(({ label, key, nullable }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-500 w-28 shrink-0">{label}</span>
                <div className="flex-1">
                  <Select
                    value={(namingConfig as any)[key]}
                    onChange={v => setNamingConfig({ [key]: v })}
                    options={POSITION_OPTIONS}
                    placeholder={nullable ? 'Não utilizado' : undefined}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400">
            As partes coloridas acima mostram o que cada posição representa no seu arquivo.
          </p>
        </div>

        {/* Category mappings */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-gray-700">Siglas de categoria</p>
            {mappingAdded && <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1"><Check size={10} /> Salvo</span>}
          </div>
          <div className="border border-sand-md rounded-xl overflow-hidden divide-y divide-sand-md">
            {namingConfig.categoryMappings.map(m => (
              <div key={m.keyword} className="flex items-center px-3 py-2 gap-2 bg-white">
                <span className="font-mono text-[11px] text-gray-500 w-20 shrink-0">{m.keyword}</span>
                <span className="text-[11px] text-gray-700 flex-1">{m.label}</span>
                <button
                  onClick={() => removeMapping(m.keyword)}
                  className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={newKw}
              onChange={e => setNewKw(e.target.value.toUpperCase())}
              placeholder="Sigla (ex: ARQ)"
              className={`flex-none w-24 ${inputCls}`}
            />
            <input
              value={newLbl}
              onChange={e => setNewLbl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMapping()}
              placeholder="Nome completo"
              className={`flex-1 ${inputCls}`}
            />
            <button
              onClick={addMapping}
              disabled={!newKw.trim() || !newLbl.trim()}
              className="h-8 px-2.5 bg-brand text-white rounded-lg text-xs flex items-center gap-1 hover:bg-brand-dk transition disabled:opacity-40"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="px-4 py-3 border-t border-sand-md shrink-0 bg-white/60 space-y-1.5">
        {saveError && (
          <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={11} /> {saveError}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || loadingRemote}
          className={`w-full h-10 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60
            ${saved ? 'bg-emerald-500 text-white' : 'bg-brand text-white hover:bg-brand-dk'}`}
        >
          {saved ? <><Check size={14} /> Salvo!</> : saving ? 'Salvando...' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  )
}
