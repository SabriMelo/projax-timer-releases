import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Project {
  id: string
  name: string
  code: string
  status: string
}

export interface TimeEntry {
  id: string
  project_id: string
  project: { id: string; name: string; code: string }
  minutes: number
  description: string | null
  date: string
  created_at: string
}

export interface DetectedFile {
  fileName: string
  app: string
  active: boolean   // true = essa janela está em foco no momento
}

export interface CategoryMapping {
  keyword: string   // ex: "PB"
  label: string     // ex: "Planta Baixa"
}

export interface NamingConfig {
  separator: string           // '_', '-', ' ', '.'
  codePosition: number        // índice da parte que contém o código (0-based)
  clientPosition: number | null
  categoryPosition: number | null
  categoryMappings: CategoryMapping[]
  configured: boolean
}

const DEFAULT_CATEGORIES: CategoryMapping[] = [
  { keyword: 'PB',           label: 'Planta Baixa' },
  { keyword: 'PLANTABAIXA',  label: 'Planta Baixa' },
  { keyword: 'CORTE',        label: 'Corte' },
  { keyword: 'CRT',          label: 'Corte' },
  { keyword: 'FAC',          label: 'Fachada' },
  { keyword: 'FACHADA',      label: 'Fachada' },
  { keyword: 'IMPL',         label: 'Implantação' },
  { keyword: 'COB',          label: 'Cobertura' },
  { keyword: 'DET',          label: 'Detalhes' },
  { keyword: 'PERSP',        label: 'Perspectiva' },
  { keyword: 'RENDER',       label: 'Render' },
  { keyword: 'EXEC',         label: 'Executivo' },
  { keyword: 'EXECUTIVO',    label: 'Executivo' },
  { keyword: 'ANT',          label: 'Anteprojeto' },
  { keyword: 'EST',          label: 'Estudo Preliminar' },
  { keyword: 'MEM',          label: 'Memorial Descritivo' },
]

export interface ParsedFile {
  code: string | null
  client: string | null
  category: string | null
  projectId: string | null    // preenchido após match com projetos
}

export interface TrackSession {
  fileName: string
  app: string
  parsed: ParsedFile
  projectId: string | null
  startedAt: number | null
  elapsedSeconds: number
  running: boolean
}

interface StoreState {
  // Auth
  token: string | null
  userName: string | null
  userRole: string | null
  setAuth: (token: string, name: string) => void
  setRole: (role: string) => void
  clearAuth: () => void

  // Projects
  projects: Project[]
  setProjects: (p: Project[]) => void

  // Naming config (definido pelo admin)
  namingConfig: NamingConfig
  setNamingConfig: (c: Partial<NamingConfig>) => void

  // Parse filename usando a config
  parseFileName: (fileName: string) => ParsedFile

  // Sessions ativas
  sessions: Record<string, TrackSession>
  upsertSession: (file: DetectedFile) => void
  removeSession: (fileName: string) => void
  setSessionProject: (fileName: string, projectId: string) => void
  startSession: (fileName: string) => void
  pauseSession: (fileName: string) => void
  pauseAllSessions: () => string[]           // retorna fileNames que estavam rodando
  resumeSessions: (fileNames: string[]) => void
  subtractSeconds: (fileNames: string[], seconds: number) => void
  getSessionSeconds: (fileName: string) => number
  recheckSessions: () => void

  // History
  entries: TimeEntry[]
  setEntries: (e: TimeEntry[]) => void
  addEntry: (e: TimeEntry) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Auth
      token: null,
      userName: null,
      userRole: null,
      setAuth: (token, name) => set({ token, userName: name }),
      setRole: (role) => set({ userRole: role }),
      clearAuth: () => set({ token: null, userName: null, userRole: null, projects: [], entries: [], sessions: {} }),

      // Projects
      projects: [],
      setProjects: p => set({ projects: p }),

      // Naming config
      namingConfig: {
        separator: '-',
        codePosition: 0,
        clientPosition: 2,
        categoryPosition: 3,
        categoryMappings: DEFAULT_CATEGORIES,
        configured: false,
      },
      setNamingConfig: (c) =>
        set(s => ({ namingConfig: { ...s.namingConfig, ...c } })),

      // Parse usando config atual
      parseFileName: (fileName) => {
        const { namingConfig, projects } = get()
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')
        const parts = nameWithoutExt.split(namingConfig.separator)

        const code = namingConfig.codePosition < parts.length
          ? parts[namingConfig.codePosition].trim().toUpperCase()
          : null

        const client = namingConfig.clientPosition !== null && namingConfig.clientPosition < parts.length
          ? parts[namingConfig.clientPosition].trim()
          : null

        const rawCat = namingConfig.categoryPosition !== null && namingConfig.categoryPosition < parts.length
          ? parts[namingConfig.categoryPosition].trim().toUpperCase()
          : null

        const category = rawCat
          ? (namingConfig.categoryMappings.find(m => m.keyword.toUpperCase() === rawCat)?.label ?? rawCat)
          : null

        // Normaliza: remove tudo que não for letra ou número
        const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

        // Match: compara normalizado inteiro OU o código do projeto termina com o código do arquivo
        // Ex: web="PROJ - 001" → "PROJ001", arquivo="001" → "001" → PROJ001.endsWith("001") ✓
        const matched = code
          ? projects.find(p => {
              const projNorm = normalize(p.code)
              const fileNorm = normalize(code)
              return projNorm === fileNorm || projNorm.endsWith(fileNorm)
            }) ?? null
          : null

        return { code, client, category, projectId: matched?.id ?? null }
      },

      // Sessions
      sessions: {},

      upsertSession: (file) => set(s => {
        const existing = s.sessions[file.fileName]
        if (existing) {
          // Tenta vincular projeto a cada tick se ainda não vinculou
          if (!existing.projectId) {
            const parsed = get().parseFileName(file.fileName)
            if (parsed.projectId) {
              return {
                sessions: {
                  ...s.sessions,
                  [file.fileName]: {
                    ...existing,
                    app: file.app,
                    parsed,
                    projectId: parsed.projectId,
                  },
                },
              }
            }
          }
          return { sessions: { ...s.sessions, [file.fileName]: { ...existing, app: file.app } } }
        }
        // Sessão nova — sempre começa contando, projeto vincula quando disponível
        const parsed = get().parseFileName(file.fileName)
        const projectId = parsed.projectId
        return {
          sessions: {
            ...s.sessions,
            [file.fileName]: {
              fileName: file.fileName,
              app: file.app,
              parsed,
              projectId,
              startedAt: Date.now(),
              elapsedSeconds: 0,
              running: true,
            },
          },
        }
      }),

      recheckSessions: () => set(s => {
        const updated: Record<string, TrackSession> = {}
        let changed = false
        for (const [key, session] of Object.entries(s.sessions)) {
          if (!session.projectId) {
            const parsed = get().parseFileName(session.fileName)
            if (parsed.projectId) {
              updated[key] = { ...session, parsed, projectId: parsed.projectId, running: true, startedAt: Date.now() }
              changed = true
              continue
            }
          }
          updated[key] = session
        }
        return changed ? { sessions: updated } : {}
      }),

      removeSession: (fileName) => set(s => {
        const next = { ...s.sessions }
        delete next[fileName]
        return { sessions: next }
      }),

      setSessionProject: (fileName, projectId) => set(s => {
        const session = s.sessions[fileName]
        if (!session) return {}
        return {
          sessions: {
            ...s.sessions,
            [fileName]: { ...session, projectId, running: true, startedAt: Date.now() },
          },
        }
      }),

      startSession: (fileName) => set(s => {
        const session = s.sessions[fileName]
        if (!session || session.running) return {}
        return { sessions: { ...s.sessions, [fileName]: { ...session, running: true, startedAt: Date.now() } } }
      }),

      pauseSession: (fileName) => set(s => {
        const session = s.sessions[fileName]
        if (!session || !session.running) return {}
        const extra = session.startedAt ? Math.floor((Date.now() - session.startedAt) / 1000) : 0
        return {
          sessions: {
            ...s.sessions,
            [fileName]: { ...session, running: false, startedAt: null, elapsedSeconds: session.elapsedSeconds + extra },
          },
        }
      }),

      pauseAllSessions: () => {
        const running: string[] = []
        set(s => {
          const next: Record<string, TrackSession> = {}
          for (const [key, session] of Object.entries(s.sessions)) {
            if (session.running) {
              running.push(key)
              const extra = session.startedAt ? Math.floor((Date.now() - session.startedAt) / 1000) : 0
              next[key] = { ...session, running: false, startedAt: null, elapsedSeconds: session.elapsedSeconds + extra }
            } else {
              next[key] = session
            }
          }
          return { sessions: next }
        })
        return running
      },

      resumeSessions: (fileNames) => set(s => {
        const next = { ...s.sessions }
        for (const fn of fileNames) {
          if (next[fn]) next[fn] = { ...next[fn], running: true, startedAt: Date.now() }
        }
        return { sessions: next }
      }),

      subtractSeconds: (fileNames, seconds) => set(s => {
        const next = { ...s.sessions }
        for (const fn of fileNames) {
          if (next[fn]) next[fn] = { ...next[fn], elapsedSeconds: Math.max(0, next[fn].elapsedSeconds - seconds) }
        }
        return { sessions: next }
      }),

      getSessionSeconds: (fileName) => {
        const s = get().sessions[fileName]
        if (!s) return 0
        if (s.running && s.startedAt) return s.elapsedSeconds + Math.floor((Date.now() - s.startedAt) / 1000)
        return s.elapsedSeconds
      },

      // History
      entries: [],
      setEntries: e => set({ entries: e }),
      addEntry: e => set(s => ({ entries: [e, ...s.entries] })),
    }),
    {
      name: 'projax-timer-v4',
      partialize: s => ({
        token: s.token,
        userName: s.userName,
        userRole: s.userRole,
        namingConfig: s.namingConfig,
      }),
      onRehydrateStorage: () => (state) => {
        // Migra config antiga com separador errado
        if (state && !state.namingConfig.configured) {
          state.namingConfig.separator = '-'
          state.namingConfig.codePosition = 0
          state.namingConfig.clientPosition = 2
          state.namingConfig.categoryPosition = 3
        }
      },
    }
  )
)
