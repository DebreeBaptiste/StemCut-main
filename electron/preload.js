const { ipcRenderer, shell } = require("electron");

window.__ELECTRON__ = true;

window.electronAPI = {
  getStorageDir: () => ipcRenderer.invoke("get-storage-dir"),
  chooseStorageDir: () => ipcRenderer.invoke("choose-storage-dir"),
  openPath: (p) => ipcRenderer.invoke("open-path", p),
  saveDownload: (base64Data, filename) =>
    ipcRenderer.invoke("save-download", base64Data, filename),
  getDownloadsDir: () => ipcRenderer.invoke("get-downloads-dir"),
  migrateStorageData: (fromDir, toDir) =>
    ipcRenderer.invoke("migrate-storage-data", fromDir, toDir),
};
