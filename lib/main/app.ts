import { BrowserWindow, shell, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import appIcon from '@/resources/build/icon.png?asset'
import { registerResourcesProtocol } from './protocols'
import { registerWindowHandlers } from '@/lib/conveyor/handlers/window-handler'
import { registerAppHandlers } from '@/lib/conveyor/handlers/app-handler'

export function createAppWindow(): void {
  // Register custom protocol for resources
  registerResourcesProtocol()

  // Create the main window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#1c1c1c',
    icon: appIcon,
    frame: false,
    titleBarStyle: 'hiddenInset',
    title: 'ClinicLab Reporter',
    maximizable: true,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
    },
  })

  // Register IPC events for the main window.
  registerWindowHandlers(mainWindow)
  registerAppHandlers(app)

  mainWindow.on('ready-to-show', () => {
    // Start maximized
    try {
      mainWindow.maximize()
    } catch (e) {
      console.error('Failed to maximize window', e)
    }
    mainWindow.show()
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    console.warn('[LOAD] Dev mode URL ->', process.env['ELECTRON_RENDERER_URL'])
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // Production: attempt several likely locations for index.html
    const candidates = [
      join(__dirname, '../renderer/index.html'), // expected when electron-vite outputs renderer folder
      join(__dirname, '../index.html'), // fallback if renderer not nested
      join(process.resourcesPath, 'app.asar', 'out', 'renderer', 'index.html'),
      join(process.resourcesPath, 'app.asar', 'out', 'index.html'),
    ]
    const chosen = candidates.find((p) => existsSync(p))
    if (!chosen) {
      console.error('[LOAD][FATAL] Could not find any index.html. Tried:')
      candidates.forEach((c) => console.error('  -', c))
    } else {
      console.warn('[LOAD] Using renderer index:', chosen)
      mainWindow.loadFile(chosen).catch((err) => {
        console.error('[LOAD] loadFile failed:', err)
      })
    }

    mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
      console.error('[LOAD] did-fail-load', { code, desc, url })
    })
    mainWindow.webContents.on('render-process-gone', (_, details) => {
      console.error('[RENDER] gone:', details)
    })
    mainWindow.webContents.on('console-message', (_, level, message) => {
      console.warn('[RENDERER]', level, message)
    })
  }
}
