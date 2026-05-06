const {
  app,
  BrowserWindow,
  utilityProcess,
  ipcMain,
  dialog,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const NEXT_PORT = 3000;
const BACKEND_PORT = 8000;
const IS_DEV = !app.isPackaged;

let mainWindow;
let backendProcess;
let frontendProcess;

// ── Config ────────────────────────────────────────────────────────────────────

function getConfigPath() {
  return path.join(app.getPath("userData"), "stemcut-config.json");
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), "utf8");
}

function getStorageDir() {
  const config = loadConfig();
  return (
    config.storageDir || path.join(app.getPath("appData"), "StemCut", "storage")
  );
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// ── Backend ───────────────────────────────────────────────────────────────────

function startBackend(storageDir) {
  const storage = storageDir || getStorageDir();
  let cmd, args, cwd, env;

  if (IS_DEV) {
    const pythonBin =
      process.platform === "win32"
        ? path.join(".venv", "Scripts", "python.exe")
        : path.join(".venv", "bin", "python");
    cmd = path.join(ROOT, pythonBin);
    args = [
      "-m",
      "uvicorn",
      "main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(BACKEND_PORT),
    ];
    cwd = path.join(ROOT, "backend");
    env = {
      ...process.env,
      HOME: app.getPath("home"),
      TMPDIR: app.getPath("temp"),
      PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
      STEMCUT_STORAGE: storage,
    };
  } else if (process.platform === "win32") {
    const binDir = path.join(
      process.resourcesPath,
      "backend-bin",
      "stemcut-backend",
    );
    cmd = path.join(binDir, "stemcut-backend.exe");
    args = [];
    cwd = binDir;
    env = { ...process.env, STEMCUT_STORAGE: storage };
  } else {
    const binDir = path.join(
      process.resourcesPath,
      "backend-bin",
      "stemcut-backend",
    );
    cmd = path.join(binDir, "stemcut-backend");
    args = [];
    cwd = binDir;
    env = {
      ...process.env,
      HOME: app.getPath("home"),
      TMPDIR: app.getPath("temp"),
      PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
      STEMCUT_STORAGE: storage,
    };
  }

  backendProcess = spawn(cmd, args, { cwd, env });

  const stderrLines = [];
  backendProcess.stdout?.on("data", (d) =>
    process.stdout.write("[backend] " + d),
  );
  backendProcess.stderr.on("data", (d) => {
    process.stdout.write("[backend] " + d);
    stderrLines.push(d.toString());
    if (stderrLines.length > 30) stderrLines.shift();
  });

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const TIMEOUT = 60_000;

    const onExit = (code) => {
      const detail = stderrLines.join("").trim() || "Aucun détail disponible.";
      reject(new Error(`Le backend s'est arrêté (code ${code}).\n\n${detail}`));
    };
    const onError = (err) => {
      backendProcess.removeListener("exit", onExit);
      reject(
        new Error(
          `Impossible de démarrer le backend.\n\n${err.message}\n\nFichier attendu : ${cmd}`,
        ),
      );
    };
    backendProcess.once("exit", onExit);
    backendProcess.once("error", onError);

    const check = () => {
      if (Date.now() - start > TIMEOUT) {
        backendProcess.removeListener("exit", onExit);
        reject(
          new Error("Le backend n'a pas répondu dans le délai imparti (60s)."),
        );
        return;
      }
      http
        .get(`http://localhost:${BACKEND_PORT}`, () => {
          backendProcess.removeListener("exit", onExit);
          backendProcess.removeListener("error", onError);
          resolve();
        })
        .on("error", () => setTimeout(check, 500));
    };
    check();
  });
}

function waitForPort(port, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start > timeout) {
        reject(
          new Error(`Le frontend n'a pas répondu dans le délai imparti (30s).`),
        );
        return;
      }
      http
        .get(`http://localhost:${port}`, () => resolve())
        .on("error", () => setTimeout(check, 500));
    };
    check();
  });
}

function startFrontend() {
  if (IS_DEV) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    frontendProcess = spawn(npm, ["run", "dev"], {
      cwd: path.join(ROOT, "frontend"),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
    });
    if (frontendProcess.stdout)
      frontendProcess.stdout.on("data", (d) =>
        process.stdout.write("[frontend] " + d),
      );
    if (frontendProcess.stderr)
      frontendProcess.stderr.on("data", (d) =>
        process.stdout.write("[frontend] " + d),
      );
  } else {
    const serverPath = path.join(
      process.resourcesPath,
      "frontend-standalone",
      "server.js",
    );
    frontendProcess = utilityProcess.fork(serverPath, [], {
      stdio: "pipe",
      env: {
        ...process.env,
        PORT: String(NEXT_PORT),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      },
    });
    frontendProcess.stdout?.on("data", (d) =>
      process.stdout.write("[frontend] " + d),
    );
    frontendProcess.stderr?.on("data", (d) =>
      process.stdout.write("[frontend] " + d),
    );
  }

  return waitForPort(NEXT_PORT);
}

async function createWindow() {
  console.log("Starting backend...");
  await startBackend();
  console.log("Backend ready.");

  console.log("Starting frontend...");
  await startFrontend();
  console.log("Frontend ready.");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(
      __dirname,
      "icons",
      process.platform === "darwin" ? "icon.icns" : "icon.png",
    ),
    webPreferences: {
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${NEXT_PORT}`);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function killAll() {
  if (backendProcess) backendProcess.kill();
  if (frontendProcess) frontendProcess.kill();
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle("get-storage-dir", () => getStorageDir());

ipcMain.handle("choose-storage-dir", async () => {
  const oldDir = getStorageDir();
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Choisir le répertoire de stockage",
    defaultPath: oldDir,
  });
  if (result.canceled || !result.filePaths.length) return null;

  const newDir = result.filePaths[0];
  const config = loadConfig();
  config.storageDir = newDir;
  saveConfig(config);

  // Restart backend with new storage dir
  if (backendProcess) {
    backendProcess.kill();
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  await startBackend(newDir);

  return { newDir, oldDir };
});

ipcMain.handle("open-path", (_event, filePath) => shell.openPath(filePath));

ipcMain.handle("get-downloads-dir", () => app.getPath("downloads"));

ipcMain.handle("save-download", async (_event, base64Data, filename) => {
  const downloadsDir = app.getPath("downloads");
  const targetPath = path.join(downloadsDir, filename);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(targetPath, buffer);
  return targetPath;
});

ipcMain.handle("migrate-storage-data", async (_event, fromDir, toDir) => {
  if (!fromDir || !toDir) {
    throw new Error("Dossiers source et destination requis.");
  }

  const source = path.resolve(String(fromDir));
  const target = path.resolve(String(toDir));

  if (source === target) {
    return { movedJobs: 0, source, target };
  }
  if (!fs.existsSync(source)) {
    throw new Error(`Dossier source introuvable: ${source}`);
  }

  fs.mkdirSync(target, { recursive: true });

  const jobDirs = fs
    .readdirSync(source, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  let movedJobs = 0;
  for (const jobName of jobDirs) {
    const srcJob = path.join(source, jobName);
    const dstJob = path.join(target, jobName);
    if (!fs.existsSync(dstJob)) {
      copyDirRecursive(srcJob, dstJob);
      movedJobs += 1;
    }
  }

  return { movedJobs, source, target };
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.setName("StemCut");

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock.setIcon(path.join(__dirname, "icons", "icon.png"));
  }
  createWindow().catch((err) => {
    const logPath = path.join(getStorageDir(), "stemcut.log");
    dialog.showErrorBox(
      "StemCut — Erreur au démarrage",
      `L'application n'a pas pu démarrer.\n\n${err.message}\n\nJournal : ${logPath}`,
    );
    app.quit();
  });
});

app.on("window-all-closed", () => {
  killAll();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", killAll);

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
