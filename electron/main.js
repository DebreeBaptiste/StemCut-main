const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

const ROOT = path.join(__dirname, '..')
const NEXT_PORT = 3000
const BACKEND_PORT = 8000

let mainWindow
let backendProcess
let frontendProcess

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      http.get(`http://localhost:${port}`, () => resolve())
        .on('error', () => {
          if (Date.now() - start > timeout) reject(new Error(`Port ${port} timeout`))
          else setTimeout(check, 500)
        })
    }
    check()
  })
}

function startBackend() {
  const venvPython = path.join(ROOT, '.venv', 'bin', 'python')
  backendProcess = spawn(venvPython, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)], {
    cwd: path.join(ROOT, 'backend'),
  })
  backendProcess.stderr.on('data', (d) => process.stdout.write('[backend] ' + d))
  return waitForPort(BACKEND_PORT)
}

function startFrontend() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  frontendProcess = spawn(npm, ['run', 'dev'], {
    cwd: path.join(ROOT, 'frontend'),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
  })
  frontendProcess.stdout.on('data', (d) => process.stdout.write('[frontend] ' + d))
  frontendProcess.stderr.on('data', (d) => process.stdout.write('[frontend] ' + d))
  return waitForPort(NEXT_PORT)
}

async function createWindow() {
  console.log('Starting backend...')
  await startBackend()
  console.log('Backend ready.')

  console.log('Starting frontend...')
  await startFrontend()
  console.log('Frontend ready.')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'icons', process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
    webPreferences: { contextIsolation: true },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  })

  mainWindow.loadURL(`http://localhost:${NEXT_PORT}`)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

function killAll() {
  if (backendProcess) backendProcess.kill()
  if (frontendProcess) frontendProcess.kill()
}

app.setName('StemCut')

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'icons', 'icon.png'))
  }
  createWindow()
})

app.on('window-all-closed', () => {
  killAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', killAll)

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
