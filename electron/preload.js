const { ipcRenderer, shell } = require('electron');

window.__ELECTRON__ = true;

window.electronAPI = {
  getStorageDir: () => ipcRenderer.invoke('get-storage-dir'),
  chooseStorageDir: () => ipcRenderer.invoke('choose-storage-dir'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
};
