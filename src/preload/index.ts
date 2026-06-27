import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  apiRequest: (opts: { method?: string; url: string; body?: any; token?: string }) =>
    ipcRenderer.invoke('api:request', opts),

  startDetection: () => ipcRenderer.send('detection:start'),
  stopDetection: () => ipcRenderer.send('detection:stop'),

  onFilesDetected: (cb: (files: { fileName: string; app: string }[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, files: any) => cb(files)
    ipcRenderer.on('files:detected', handler)
    return () => ipcRenderer.removeListener('files:detected', handler)
  },

  onIdleUpdate: (cb: (seconds: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: number) => cb(s)
    ipcRenderer.on('idle:update', handler)
    return () => ipcRenderer.removeListener('idle:update', handler)
  },

  diagnose: () => ipcRenderer.invoke('detection:diagnose'),

  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow:    () => ipcRenderer.send('window:close'),

  openExternal: (url: string) => ipcRenderer.send('auth:open-external', url),
  onAuthCallback: (cb: (url: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, url: string) => cb(url)
    ipcRenderer.on('auth:callback', handler)
    return () => ipcRenderer.removeListener('auth:callback', handler)
  },
})
