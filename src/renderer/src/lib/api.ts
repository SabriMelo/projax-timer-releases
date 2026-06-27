const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

declare global {
  interface Window {
    electronAPI: {
      apiRequest: (opts: {
        method?: string
        url: string
        body?: any
        token?: string
      }) => Promise<{ ok: boolean; status: number; data: any }>

      startDetection: () => void
      stopDetection: () => void

      onFilesDetected: (
        cb: (files: { fileName: string; app: string }[]) => void
      ) => () => void

      onIdleUpdate: (cb: (seconds: number) => void) => () => void
      onAuthCallback: (cb: (callbackUrl: string) => void) => () => void
      openExternal: (url: string) => void

      diagnose: () => Promise<{
        files: { fileName: string; app: string }[]
        procs: { name: string; title: string; matchedApp: string | null; detectedFile: string | null }[]
        error: string | null
      }>

      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow:    () => void
    }
  }
}

export async function apiRequest<T = any>(
  path: string,
  opts: { method?: string; body?: any; token?: string } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await window.electronAPI.apiRequest({ url, ...opts })
  if (!res.ok) throw new Error(res.data?.error ?? `HTTP ${res.status}`)
  return res.data
}
