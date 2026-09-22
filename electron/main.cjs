const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { startLocalServer } = require("./server.cjs");

let mainWindow;
let server;

function dataDir() {
  return path.join(app.getPath("userData"), "data");
}

function staticDir() {
  return path.join(__dirname, "..", "dist");
}

async function createWindow() {
  server = await startLocalServer({
    dataDir: dataDir(),
    staticDir: staticDir(),
    port: 0,
  });

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 390,
    minHeight: 640,
    title: "EcoLink",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${server.port}/`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (server) {
    void server.close();
    server = null;
  }
});
