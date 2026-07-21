import { app, BrowserWindow, ipcMain, shell, powerMonitor, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { execSync, execFileSync } from 'child_process'

// ── Apps de arquitetura monitorados ──────────────────────────────────────────
const TRACKED_APPS = [
  { process: 'acad',        name: 'AutoCAD',     exts: ['.dwg', '.dxf'] },
  { process: 'Revit',       name: 'Revit',       exts: ['.rvt', '.rfa'] },
  { process: 'SketchUp',    name: 'SketchUp',    exts: ['.skp'] },
  { process: 'ARCHICAD',    name: 'ArchiCAD',    exts: ['.pln', '.mod'] },
  { process: 'Rhino',       name: 'Rhino',       exts: ['.3dm'] },
  { process: 'Vectorworks', name: 'Vectorworks', exts: ['.vwx', '.mcd'] },
  { process: 'bricscad',    name: 'BricsCAD',    exts: ['.dwg'] },
  { process: 'zwcad',       name: 'ZWCAD',       exts: ['.dwg'] },
]

interface DetectedFile {
  fileName: string
  app: string
  active: boolean
}

interface DiagProcess {
  name: string
  title: string
  matchedApp: string | null
  detectedFile: string | null
  foreground: boolean
}

function detectOpenFiles(): DetectedFile[] {
  return runDetection().files
}

function runDetection(): { files: DetectedFile[]; procs: DiagProcess[]; error: string | null } {
  try {
    // Script único: detecta processos + janela em foco
    // Usa execFileSync para passar diretamente ao PowerShell sem passar pelo cmd.exe
    // (elimina problemas de escaping de aspas no DllImport)
    const script = `
      try { Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name FGW -Namespace PGAX -ErrorAction Stop } catch {}
      $fg = try { [PGAX.FGW]::GetForegroundWindow() } catch { [IntPtr]::Zero }
      Get-Process | Where-Object { $_.MainWindowTitle -ne '' } |
        Select-Object @{N='n';E={$_.Name}},@{N='t';E={$_.MainWindowTitle}},@{N='fg';E={$_.MainWindowHandle -eq $fg}} |
        ConvertTo-Json -Compress
    `

    const output = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8', timeout: 5000, windowsHide: true,
    })

    const raw = JSON.parse(output)
    const procs: { n: string; t: string; fg: boolean }[] = Array.isArray(raw) ? raw : [raw]

    const results: DetectedFile[] = []
    const diagProcs: DiagProcess[] = []
    const seen = new Set<string>()

    for (const proc of procs) {
      const procName = proc.n ?? ''
      const title = proc.t ?? ''
      const isForeground = proc.fg === true

      const app = TRACKED_APPS.find(a =>
        procName.toLowerCase().includes(a.process.toLowerCase())
      )

      let detectedFile: string | null = null
      if (app) {
        // 1) Tenta achar "nome.ext" literal no título (funciona pra AutoCAD, Revit etc.)
        for (const ext of app.exts) {
          const pattern = new RegExp(`([^\\\\/:*?"<>|\\r\\n\\[\\]]+\\${ext})`, 'i')
          const match = title.match(pattern)
          if (match) {
            detectedFile = match[1].trim()
            break
          }
        }

        // 2) Fallback: alguns apps (ex.: SketchUp) não colocam a extensão no título,
        // só "<nome-do-arquivo> - SketchUp 2024". Remove esse sufixo " - AppName ..." do fim.
        if (!detectedFile) {
          const suffixPattern = new RegExp(`\\s*[-–—]\\s*${app.name}\\b.*$`, 'i')
          const stripped = title.replace(suffixPattern, '').trim()
          if (stripped && stripped !== title) {
            // Remove marcador de "não salvo" (ex.: "*") que alguns apps prefixam no título —
            // sem isso, o nome do arquivo mudava a cada edição/salvamento e reiniciava a sessão.
            detectedFile = stripped.replace(/^[*\s]+/, '').trim()
          }
        }

        if (detectedFile) {
          const key = `${app.name}:${detectedFile}`
          if (!seen.has(key)) {
            seen.add(key)
            results.push({ fileName: detectedFile, app: app.name, active: isForeground })
          }
        }
        diagProcs.push({ name: procName, title, matchedApp: app.name, detectedFile, foreground: isForeground })
      }
    }

    return { files: results, procs: diagProcs, error: null }
  } catch (e: any) {
    return { files: [], procs: [], error: e.message ?? 'Erro desconhecido' }
  }
}

// ── Single instance + deep link (OAuth callback) ─────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

function handleDeepLink(url: string) {
  if (url.startsWith('projax-timer://')) {
    mainWindow?.webContents.send('auth:callback', url)
    mainWindow?.show()
    mainWindow?.focus()
  }
}

app.on('second-instance', (_event, argv) => {
  // Windows: URL vem nos argumentos da segunda instância
  const url = argv.find(a => a.startsWith('projax-timer://'))
  if (url) handleDeepLink(url)
  if (mainWindow) { mainWindow.show(); mainWindow.focus() }
})

// macOS
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

// ── Janela principal + Tray ───────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let detectionInterval: ReturnType<typeof setInterval> | null = null

function getIconPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'tray.png')
    : join(__dirname, '../../resources/tray.png')
}

function getAppIconPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png')
}

function createTray() {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Projax Timer')

  const updateMenu = () => {
    const menu = Menu.buildFromTemplate([
      {
        label: mainWindow?.isVisible() ? 'Ocultar' : 'Mostrar',
        click: () => {
          if (!mainWindow) return
          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.focus()
          }
          updateMenu()
        },
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          tray?.destroy()
          app.quit()
        },
      },
    ])
    tray?.setContextMenu(menu)
  }

  updateMenu()
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
    updateMenu()
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 380,
    minHeight: 580,
    resizable: true,
    frame: false,
    transparent: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Projax Timer',
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  // Fechar → oculta para o tray em vez de encerrar
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function startDetection() {
  const run = () => {
    const files = detectOpenFiles()
    const idleSeconds = powerMonitor.getSystemIdleTime()
    mainWindow?.webContents.send('files:detected', files)
    mainWindow?.webContents.send('idle:update', idleSeconds)
  }
  run()
  detectionInterval = setInterval(run, 5000)
}

function stopDetection() {
  if (detectionInterval) { clearInterval(detectionInterval); detectionInterval = null }
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.on('auth:open-external', (_e, url: string) => shell.openExternal(url))

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

ipcMain.handle('api:request', async (_e, { method, url, body, token }) => {
  try {
    const res = await fetch(url, {
      method: method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, data }
  } catch (err: any) {
    return { ok: false, status: 0, data: { error: err.message } }
  }
})

ipcMain.on('detection:start', () => {
  stopDetection()
  startDetection()
})

ipcMain.on('detection:stop', () => stopDetection())

ipcMain.handle('detection:diagnose', () => runDetection())

// ── App lifecycle ─────────────────────────────────────────────────────────────
declare module 'electron' {
  interface App { isQuitting: boolean }
}
app.isQuitting = false

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

  // Registra protocolo customizado para OAuth callback
  app.setAsDefaultProtocolClient('projax-timer')

  // Iniciar junto com o sistema (Windows)
  app.setLoginItemSettings({
    openAtLogin: true,
    name: 'Projax Timer',
  })

  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', () => {
  stopDetection()
  if (process.platform !== 'darwin') app.quit()
})
