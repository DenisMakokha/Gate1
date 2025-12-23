const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, shell, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { SDCardService } = require('./services/SDCardService');
const { FileWatcherService } = require('./services/FileWatcherService');
const { ApiService } = require('./services/ApiService');
const { SessionService } = require('./services/SessionService');
const { LoggerService } = require('./services/LoggerService');
const { AutoUpdateService } = require('./services/AutoUpdateService');

// Handle Squirrel installer events (Windows)
if (require('electron-squirrel-startup')) {
    app.quit();
}

const store = new Store();
let mainWindow = null;
let tray = null;
let sdCardService = null;
let fileWatcherService = null;
let apiService = null;
let sessionService = null;
let logger = null;
let autoUpdater = null;

const isDev = process.argv.includes('--dev');

// Initialize logger early
try {
    logger = new LoggerService();
    logger.info('Gate 1 Agent starting', { version: app.getVersion(), isDev });
} catch (e) {
    console.error('Failed to initialize logger:', e);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 650,
        resizable: false,
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'windows', 'main.html'));

    // Show window when ready - important for first launch UX
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        
        // Show welcome notification on first run
        const isFirstRun = !store.get('hasLaunchedBefore');
        if (isFirstRun) {
            store.set('hasLaunchedBefore', true);
            if (Notification.isSupported()) {
                new Notification({
                    title: 'Gate 1 Agent Installed',
                    body: 'Welcome! Please login to get started.',
                    icon: createTrayIcon()
                }).show();
            }
        }
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            const minimizeToTray = store.get('minimizeToTray', true);
            if (minimizeToTray) {
                event.preventDefault();
                mainWindow.hide();
                
                // Show notification that app is still running (only first time)
                const hasShownTrayNotification = store.get('hasShownTrayNotification');
                if (!hasShownTrayNotification && Notification.isSupported()) {
                    new Notification({
                        title: 'Gate 1 Agent',
                        body: 'Running in background. Click tray icon to open.',
                    }).show();
                    store.set('hasShownTrayNotification', true);
                }
                
                logger?.info('Window minimized to tray');
            }
        }
    });

    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

// Load tray icon from PNG file
function createTrayIcon() {
    const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
    try {
        return nativeImage.createFromPath(iconPath);
    } catch (e) {
        console.error('Failed to load tray icon:', e);
        return nativeImage.createEmpty();
    }
}

function createTray() {
    const icon = createTrayIcon();
    
    if (icon.isEmpty()) {
        console.warn('Tray icon is empty, using default');
    }
    
    tray = new Tray(icon);
    
    updateTrayMenu();
    
    tray.setToolTip('Gate 1 Agent - Click to open');
    
    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
    
    tray.on('double-click', () => {
        mainWindow.show();
        mainWindow.focus();
    });
}

function updateTrayMenu(status = 'offline') {
    const statusText = status === 'online' ? '🟢 Connected' : 
                       status === 'syncing' ? '🔵 Syncing' : '🔴 Offline';
    
    const contextMenu = Menu.buildFromTemplate([
        { label: `Gate 1 Agent - ${statusText}`, enabled: false },
        { type: 'separator' },
        { label: 'Open Dashboard', click: () => mainWindow.show() },
        { label: 'Sync Now', click: () => syncNow() },
        { type: 'separator' },
        { label: 'Settings', click: () => openSettings() },
        { label: 'View Logs', click: () => openLogs() },
        { type: 'separator' },
        { label: 'Quit', click: () => {
            app.isQuitting = true;
            app.quit();
        }}
    ]);
    
    tray.setContextMenu(contextMenu);
}

async function initializeServices() {
    const config = store.get('config', {});
    
    apiService = new ApiService(config.apiUrl || 'http://localhost:8000/api');
    sdCardService = new SDCardService();
    fileWatcherService = new FileWatcherService(config.watchedFolders || []);
    sessionService = new SessionService(apiService, store);

    // Set up event handlers
    sdCardService.on('sd-inserted', handleSDInserted);
    sdCardService.on('sd-removed', handleSDRemoved);
    fileWatcherService.on('file-renamed', handleFileRenamed);
    fileWatcherService.on('file-copied', handleFileCopied);

    // Start services if registered
    if (store.get('isRegistered')) {
        await startServices();
    }
}

async function startServices() {
    try {
        await sdCardService.start();
        await fileWatcherService.start();
        startHeartbeat();
        updateTrayMenu('online');
    } catch (error) {
        console.error('Failed to start services:', error);
        updateTrayMenu('offline');
    }
}

function startHeartbeat() {
    // Send initial heartbeat immediately
    sendHeartbeat();
    
    // Then send every 60 seconds (for user online status tracking)
    setInterval(sendHeartbeat, 60000);
}

async function sendHeartbeat() {
    try {
        const agentId = store.get('agentId');
        const deviceId = store.get('deviceId');
        const token = store.get('token');
        
        if (agentId && deviceId) {
            // Agent heartbeat
            await apiService.heartbeat({
                agent_id: agentId,
                device_id: deviceId,
                status: 'online',
                latency_ms: Date.now() % 100,
                watched_folders: store.get('config.watchedFolders', []),
            });
            updateTrayMenu('online');
        }
        
        // User online status heartbeat (separate from agent heartbeat)
        if (token) {
            const activity = getCurrentActivity();
            await apiService.userHeartbeat({ activity });
        }
    } catch (error) {
        console.error('Heartbeat failed:', error);
        updateTrayMenu('offline');
    }
}

function getCurrentActivity() {
    const session = sessionService?.getActiveSessions?.() || [];
    if (session.length > 0) {
        return `Processing ${session.length} SD card(s)`;
    }
    return 'Idle - Monitoring folders';
}

async function handleSDInserted(sdInfo) {
    console.log('SD Card inserted:', sdInfo);
    
    mainWindow.webContents.send('sd-inserted', sdInfo);
    
    // Check if SD is registered
    try {
        const response = await apiService.getSdCard(sdInfo.hardwareId);
        
        if (response.status === 'found') {
            // Known SD card
            mainWindow.webContents.send('sd-recognized', response.sd_card);
            await sessionService.startSession(sdInfo, response.sd_card);
        } else {
            // New SD card - prompt for binding
            mainWindow.webContents.send('sd-new', sdInfo);
            mainWindow.show();
        }
    } catch (error) {
        // New SD card
        mainWindow.webContents.send('sd-new', sdInfo);
        mainWindow.show();
    }
}

async function handleSDRemoved(sdInfo) {
    console.log('SD Card removed:', sdInfo);
    
    const session = sessionService.getActiveSession(sdInfo.hardwareId);
    
    if (session) {
        const pendingFiles = session.filesDetected - session.filesCopied;
        
        if (pendingFiles > 0) {
            // Early removal - show warning
            mainWindow.webContents.send('sd-early-removal', {
                session,
                pendingFiles,
            });
            mainWindow.show();
        } else {
            // Safe removal
            await sessionService.endSession(sdInfo.hardwareId, 'safe');
            mainWindow.webContents.send('sd-safe-removal', session);
        }
    }
}

async function handleFileRenamed(fileInfo) {
    console.log('File renamed:', fileInfo);
    
    const parseResult = parseFilename(fileInfo.newName);
    
    mainWindow.webContents.send('file-renamed', {
        ...fileInfo,
        parseResult,
    });
    
    // Sync to server
    try {
        await apiService.syncMedia({
            agent_id: store.get('agentId'),
            device_id: store.get('deviceId'),
            file: {
                filename: fileInfo.newName,
                original_path: fileInfo.path,
                type: 'before',
                size_bytes: fileInfo.size,
                checksum: fileInfo.checksum,
            },
            parsed_metadata: parseResult.metadata,
            event_id: store.get('currentEventId'),
        });
    } catch (error) {
        console.error('Failed to sync media:', error);
    }
}

async function handleFileCopied(fileInfo) {
    console.log('File copied:', fileInfo);
    
    const session = sessionService.getActiveSessionByPath(fileInfo.sourcePath);
    if (session) {
        await sessionService.updateProgress(session.sessionId, {
            filesCopied: session.filesCopied + 1,
            filesPending: session.filesPending - 1,
        });
    }
    
    mainWindow.webContents.send('file-copied', fileInfo);
}

function parseFilename(filename) {
    // Expected format: FULLNAME_AGE_CONDITION_REGION.mp4
    const name = filename.replace(/\.[^/.]+$/, ''); // Remove extension
    const parts = name.split('_');
    
    const issues = [];
    let status = 'valid';
    
    const metadata = {
        full_name: null,
        age: null,
        condition: null,
        region: null,
    };
    
    if (parts.length < 4) {
        issues.push({ field: 'format', message: 'Filename does not match expected format' });
        status = 'error';
    } else {
        // Try to parse
        // Name could be multiple parts (e.g., ROSE_AWITI)
        // Age is a number
        // Condition and Region are the last parts
        
        let ageIndex = -1;
        for (let i = 1; i < parts.length; i++) {
            if (/^\d+$/.test(parts[i])) {
                ageIndex = i;
                break;
            }
        }
        
        if (ageIndex === -1) {
            issues.push({ field: 'age', message: 'Age not found in filename' });
            status = 'warning';
        } else {
            metadata.full_name = parts.slice(0, ageIndex).join(' ');
            metadata.age = parseInt(parts[ageIndex]);
            
            if (parts.length > ageIndex + 1) {
                metadata.condition = parts[ageIndex + 1];
            } else {
                issues.push({ field: 'condition', message: 'Condition is missing' });
                status = 'error';
            }
            
            if (parts.length > ageIndex + 2) {
                metadata.region = parts.slice(ageIndex + 2).join(' ');
            } else {
                issues.push({ field: 'region', message: 'Region is missing' });
                status = status === 'error' ? 'error' : 'warning';
            }
        }
    }
    
    // Check for spaces (should use underscores)
    if (filename.includes(' ')) {
        issues.push({ field: 'format', message: 'Use underscores instead of spaces' });
        status = status === 'error' ? 'error' : 'warning';
    }
    
    return { status, issues, metadata };
}

function syncNow() {
    mainWindow.webContents.send('sync-requested');
}

function openSettings() {
    mainWindow.webContents.send('open-settings');
    mainWindow.show();
}

function openLogs() {
    mainWindow.webContents.send('open-logs');
    mainWindow.show();
}

// IPC Handlers
ipcMain.handle('get-store', (event, key) => {
    return store.get(key);
});

ipcMain.handle('set-store', (event, key, value) => {
    store.set(key, value);
    return true;
});

ipcMain.handle('register-agent', async (event, data) => {
    try {
        const response = await apiService.registerAgent(data);
        store.set('isRegistered', true);
        store.set('agentId', response.agent_id);
        store.set('deviceId', data.device_id);
        await startServices();
        return response;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('bind-sd-card', async (event, data) => {
    try {
        const response = await apiService.bindSdCard(data);
        return response;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('confirm-early-removal', async (event, sessionId, decision) => {
    try {
        await sessionService.endSession(sessionId, decision);
        return { success: true };
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('report-issue', async (event, data) => {
    try {
        const response = await apiService.reportIssue(data);
        return response;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('get-active-sessions', () => {
    return sessionService.getAllActiveSessions();
});

ipcMain.handle('login', async (event, credentials) => {
    try {
        const response = await apiService.login(credentials);
        store.set('token', response.authorization.token);
        store.set('user', response.user);
        apiService.setToken(response.authorization.token);
        return response;
    } catch (error) {
        throw error;
    }
});

// Window control handlers
ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.handle('window-close', () => {
    mainWindow.hide();
});

ipcMain.handle('sync-now', async () => {
    syncNow();
    return { success: true };
});

// App lifecycle
app.whenReady().then(async () => {
    createWindow();
    createTray();
    await initializeServices();
    
    // Initialize auto-updater (only in production)
    if (!isDev) {
        try {
            autoUpdater = new AutoUpdateService(logger);
            logger?.info('Auto-updater initialized');
            
            // Check for updates after a short delay
            setTimeout(() => {
                autoUpdater.checkForUpdates();
            }, 5000);
        } catch (e) {
            logger?.error('Failed to initialize auto-updater', e.message);
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Don't quit, just hide to tray
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', async () => {
    app.isQuitting = true;
    
    // Set user offline when app closes
    try {
        if (apiService && store.get('token')) {
            await apiService.setUserOffline();
            logger?.info('User set to offline');
        }
    } catch (e) {
        logger?.error('Failed to set user offline', e.message);
    }
});

// Settings handlers
ipcMain.handle('select-folder', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Folder to Watch',
    });
    return result.filePaths[0] || null;
});

ipcMain.handle('save-settings', async (event, config) => {
    store.set('config', config);
    logger?.info('Settings saved', config);
    
    // Update file watcher with new folders
    if (fileWatcherService && config.watchedFolders) {
        fileWatcherService.updateFolders(config.watchedFolders);
    }
    
    // Handle auto-start setting
    if (process.platform === 'win32') {
        app.setLoginItemSettings({
            openAtLogin: config.autoStart,
            path: process.execPath,
        });
    }
    
    return { success: true };
});

// Logger handlers
ipcMain.handle('get-logs', async (event, lines = 100) => {
    if (!logger) return [];
    return await logger.getRecentLogs(lines);
});

ipcMain.handle('open-logs-folder', async () => {
    if (logger) {
        shell.openPath(logger.getLogPath());
    }
});

// Auto-update handlers
ipcMain.handle('check-for-updates', async () => {
    if (autoUpdater) {
        await autoUpdater.checkForUpdates();
        return autoUpdater.getUpdateStatus();
    }
    return { available: false };
});

ipcMain.handle('download-update', async () => {
    if (autoUpdater) {
        await autoUpdater.downloadUpdate();
    }
});

ipcMain.handle('install-update', () => {
    if (autoUpdater) {
        autoUpdater.installUpdate();
    }
});

ipcMain.handle('get-app-info', () => {
    return {
        version: app.getVersion(),
        name: app.getName(),
        platform: process.platform,
        arch: process.arch,
        logsPath: logger?.getLogPath() || null,
    };
});

// Minimize to tray setting
ipcMain.handle('get-minimize-to-tray', () => {
    return store.get('minimizeToTray', true);
});

ipcMain.handle('set-minimize-to-tray', (event, value) => {
    store.set('minimizeToTray', value);
    return { success: true };
});
