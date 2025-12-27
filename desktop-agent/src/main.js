const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, shell, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const crypto = require('crypto');
const os = require('os');
const { SDCardService } = require('./services/SDCardService');
const { FileWatcherService } = require('./services/FileWatcherService');
const { ApiService } = require('./services/ApiService');
const { SessionService } = require('./services/SessionService');
const { LoggerService } = require('./services/LoggerService');
const { AutoUpdateService } = require('./services/AutoUpdateService');
const { MediaDeletionService } = require('./services/MediaDeletionService');
const { BackupService } = require('./services/BackupService');
const { AudioAnalyzer } = require('./services/AudioAnalyzer');

// Handle Squirrel installer events (Windows)
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Generate encryption key from machine-specific data for secure storage
function getEncryptionKey() {
    const machineId = `${os.hostname()}-${os.platform()}-${os.arch()}-gate1`;
    return crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 32);
}

const store = new Store({
    encryptionKey: getEncryptionKey(),
    clearInvalidConfig: true,
});
let mainWindow = null;
let tray = null;
let sdCardService = null;
let fileWatcherService = null;
let apiService = null;
let sessionService = null;
let logger = null;
let autoUpdater = null;
let mediaDeletionService = null;
let backupService = null;
let audioAnalyzer = null;

const isDev = process.argv.includes('--dev');

// Initialize logger early
try {
    logger = new LoggerService();
    logger.info('Gate 1 Agent starting', { version: app.getVersion(), isDev });
} catch (e) {
    console.error('Failed to initialize logger:', e);
}

// Global error handlers for crash recovery
process.on('uncaughtException', (error) => {
    logger?.error('Uncaught Exception', { message: error.message, stack: error.stack });
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger?.error('Unhandled Rejection', { reason: String(reason) });
    console.error('Unhandled Rejection:', reason);
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 650,
        resizable: false,
        frame: false,
        show: true,
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
    
    apiService = new ApiService(config.apiUrl || 'https://api.gate1.cloud/api');
    
    // Set up token expiry handler
    apiService.setTokenExpiredCallback(() => {
        logger?.warn('Token expired - prompting re-login');
        store.delete('token');
        mainWindow?.webContents?.send('token-expired');
        mainWindow?.show();
    });
    
    // Restore token if exists
    const savedToken = store.get('token');
    if (savedToken) {
        apiService.setToken(savedToken);
    }
    
    sdCardService = new SDCardService();
    fileWatcherService = new FileWatcherService(config.watchedFolders || []);
    sessionService = new SessionService(apiService, store);
    mediaDeletionService = new MediaDeletionService(apiService, logger);
    backupService = new BackupService(store, logger);
    audioAnalyzer = new AudioAnalyzer(logger);

    // Set up event handlers
    sdCardService.on('sd-inserted', handleSDInserted);
    sdCardService.on('sd-removed', handleSDRemoved);
    fileWatcherService.on('file-renamed', handleFileRenamed);
    fileWatcherService.on('file-copied', handleFileCopied);
    fileWatcherService.on('file-deleted', handleFileDeleted);
    fileWatcherService.on('wrong-destination', handleWrongDestination);
    
    // Backup service events
    backupService.on('backup-disk-inserted', handleBackupDiskInserted);
    backupService.on('backup-disk-removed', handleBackupDiskRemoved);
    backupService.on('backup-verify-start', (data) => mainWindow?.webContents?.send('backup-verify-start', data));
    backupService.on('backup-verify-progress', (data) => mainWindow?.webContents?.send('backup-verify-progress', data));
    backupService.on('backup-verify-complete', (data) => mainWindow?.webContents?.send('backup-verify-complete', data));
    
    // Session service events for banner
    sessionService.on('session-started', (session) => mainWindow?.webContents?.send('session-started', session));
    sessionService.on('session-progress', (session) => mainWindow?.webContents?.send('session-progress', session));
    sessionService.on('session-ended', (session) => mainWindow?.webContents?.send('session-ended', session));

    // Don't auto-start heavy services - wait for user to be on dashboard
    // Services will start after successful registration or on dashboard load
}

async function startServices() {
    try {
        await sdCardService.start();
        await fileWatcherService.start();
        
        // Start media deletion service if device is registered
        const deviceId = store.get('deviceId');
        if (deviceId && mediaDeletionService) {
            mediaDeletionService.setDeviceId(deviceId);
            // Pass watched folders for file search during deletion
            const config = store.get('config', {});
            mediaDeletionService.setWatchedFolders(config.watchedFolders || []);
            await mediaDeletionService.start();
        }
        
        // Start backup service for backup disk detection
        if (backupService) {
            await backupService.start();
        }
        
        startHeartbeat();
        updateTrayMenu('online');
    } catch (error) {
        console.error('Failed to start services:', error);
        updateTrayMenu('offline');
    }
}

let heartbeatInterval = null;
let wasOffline = false;

function startHeartbeat() {
    // Send initial heartbeat immediately
    sendHeartbeat();
    
    // Then send every 60 seconds (for user online status tracking)
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(sendHeartbeat, 60000);
}

async function handleReconnection() {
    logger?.info('Connection restored - processing offline queue');
    
    // Process any queued operations
    if (apiService?.pendingSync?.length > 0) {
        try {
            const result = await apiService.processSyncQueue();
            logger?.info('Offline queue processed', result);
            
            if (result.processed > 0) {
                mainWindow?.webContents?.send('sync-complete', result);
            }
        } catch (error) {
            logger?.error('Failed to process sync queue', error.message);
        }
    }
    
    // Notify UI of reconnection
    mainWindow?.webContents?.send('connection-online');
}

async function sendHeartbeat() {
    try {
        const agentId = store.get('agentId');
        const deviceId = store.get('deviceId');
        const token = store.get('token');
        
        if (agentId && deviceId) {
            // Agent heartbeat with real latency
            const pingResult = await apiService.ping();
            
            // Detect reconnection
            if (pingResult.online && wasOffline) {
                wasOffline = false;
                await handleReconnection();
            } else if (!pingResult.online) {
                wasOffline = true;
                mainWindow?.webContents?.send('connection-offline');
            }
            
            await apiService.heartbeat({
                agent_id: agentId,
                device_id: deviceId,
                status: pingResult.online ? 'online' : 'degraded',
                latency_ms: pingResult.latency || 0,
                watched_folders: store.get('config.watchedFolders', []),
            });
            updateTrayMenu(pingResult.online ? 'online' : 'offline');
        }
        
        // User online status heartbeat (separate from agent heartbeat)
        if (token) {
            const activity = getCurrentActivity();
            await apiService.userHeartbeat({ activity });
        }
    } catch (error) {
        console.error('Heartbeat failed:', error);
        wasOffline = true;
        updateTrayMenu('offline');
        mainWindow?.webContents?.send('connection-offline');
    }
}

function getCurrentActivity() {
    const sessions = sessionService?.getAllActiveSessions?.() || [];
    if (sessions.length > 0) {
        return `Processing ${sessions.length} SD card(s)`;
    }
    return 'Idle - Monitoring folders';
}

async function handleSDInserted(sdInfo) {
    console.log('SD Card inserted:', sdInfo);
    
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('sd-inserted', sdInfo);
    
    // Check if SD is registered
    try {
        const response = await apiService.getSdCard(sdInfo.hardwareId);
        
        if (response.status === 'found') {
            // Known SD card
            mainWindow.webContents.send('sd-recognized', response.sd_card);
            
            // Fetch and store event metadata for offline auto-deletion
            // This ensures deletion works even if editor never comes online again
            if (response.sd_card.event_id) {
                try {
                    const eventData = await apiService.getEvent(response.sd_card.event_id);
                    if (eventData) {
                        // Store event metadata locally for offline deletion
                        store.set(`events.${eventData.id}`, {
                            id: eventData.id,
                            name: eventData.name,
                            start_date: eventData.start_date,
                            end_date: eventData.end_date,
                            end_datetime: eventData.end_datetime,
                            auto_delete_days_after_end: eventData.auto_delete_days_after_end || 0,
                            auto_delete_enabled: eventData.auto_delete_enabled,
                        });
                        logger?.info('Event metadata stored for offline deletion', { eventId: eventData.id });
                    }
                } catch (e) {
                    logger?.warn('Could not fetch event details', e.message);
                }
            }
            
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
    
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const session = sessionService?.getActiveSession(sdInfo.hardwareId);
    
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
    
    if (!mainWindow || mainWindow.isDestroyed()) return;
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
    
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const session = sessionService?.getActiveSessionByPath(fileInfo.sourcePath);
    if (session) {
        await sessionService.updateProgress(session.sessionId, {
            filesCopied: session.filesCopied + 1,
            filesPending: session.filesPending - 1,
        });
        
        // Track file for auto-deletion after event ends (data protection)
        // Stores event end date locally for offline deletion
        if (mediaDeletionService && session.eventId) {
            const eventInfo = store.get(`events.${session.eventId}`, {});
            mediaDeletionService.trackFileForDeletion(fileInfo, {
                eventId: session.eventId,
                eventName: eventInfo.name || session.eventName,
                eventStartDate: eventInfo.start_date,
                eventEndDate: eventInfo.end_date,
                eventEndDatetime: eventInfo.end_datetime,
                autoDeleteDays: eventInfo.auto_delete_days_after_end || 0,
            }).catch(() => {}); // Non-blocking
        }
    }
    
    mainWindow.webContents.send('file-copied', fileInfo);
    
    // Run lightweight audio analysis in background (non-blocking)
    analyzeFileAudio(fileInfo).catch(() => {});
}

function parseFilename(filename) {
    // Expected format: FULLNAME_AGE_CONDITION_REGION.mp4
    const name = filename.replace(/\.[^/.]+$/, ''); // Remove extension
    
    const issues = [];
    let status = 'valid';
    
    const metadata = {
        full_name: null,
        age: null,
        condition: null,
        region: null,
    };
    
    // Check for common separator issues FIRST
    if (filename.includes(' ')) {
        issues.push({ field: 'separator', message: 'Use underscores (_) instead of spaces', severity: 'warning' });
        status = 'warning';
    }
    
    if (filename.includes('-') && !filename.includes('_')) {
        issues.push({ field: 'separator', message: 'Use underscores (_) instead of dashes (-)', severity: 'warning' });
        status = 'warning';
    }
    
    // Check for mixed separators
    if (filename.includes('-') && filename.includes('_')) {
        issues.push({ field: 'separator', message: 'Inconsistent separators - use only underscores (_)', severity: 'minor' });
        if (status === 'valid') status = 'warning';
    }
    
    // Check for special characters that shouldn't be in filenames
    if (/[<>:"/\\|?*]/.test(filename)) {
        issues.push({ field: 'characters', message: 'Contains invalid characters', severity: 'error' });
        status = 'error';
    }
    
    // Try to parse using multiple possible separators
    let parts = name.split('_');
    if (parts.length < 3) {
        // Try splitting by dash or space as fallback
        parts = name.split(/[-\s_]+/);
    }
    
    if (parts.length < 4) {
        issues.push({ field: 'format', message: 'Missing components. Expected: NAME_AGE_CONDITION_REGION', severity: 'error' });
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
            issues.push({ field: 'age', message: 'Age not found - should be a number', severity: 'warning' });
            if (status === 'valid') status = 'warning';
        } else {
            metadata.full_name = parts.slice(0, ageIndex).join(' ');
            metadata.age = parseInt(parts[ageIndex]);
            
            // Validate age is reasonable
            if (metadata.age < 1 || metadata.age > 120) {
                issues.push({ field: 'age', message: `Age ${metadata.age} seems incorrect`, severity: 'warning' });
                if (status === 'valid') status = 'warning';
            }
            
            if (parts.length > ageIndex + 1) {
                metadata.condition = parts[ageIndex + 1];
                
                // Check if condition looks valid (should be text, not numbers)
                if (/^\d+$/.test(metadata.condition)) {
                    issues.push({ field: 'condition', message: 'Condition should be text, not a number', severity: 'warning' });
                    if (status === 'valid') status = 'warning';
                }
            } else {
                issues.push({ field: 'condition', message: 'Condition is missing', severity: 'error' });
                status = 'error';
            }
            
            if (parts.length > ageIndex + 2) {
                metadata.region = parts.slice(ageIndex + 2).join(' ');
            } else {
                issues.push({ field: 'region', message: 'Region is missing', severity: 'warning' });
                if (status === 'valid') status = 'warning';
            }
        }
    }
    
    // Check for all caps (preferred) vs mixed case
    const hasLowercase = /[a-z]/.test(name);
    if (hasLowercase && status === 'valid') {
        // Just a minor tip, not an issue
        issues.push({ field: 'case', message: 'Consider using UPPERCASE for consistency', severity: 'minor' });
    }
    
    return { status, issues, metadata };
}

async function handleFileDeleted(fileInfo) {
    console.log('⚠️ File DELETED (not allowed!):', fileInfo);
    
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    // Send to UI for warning
    mainWindow.webContents.send('file-deleted', fileInfo);
    mainWindow.show(); // Bring window to front for this serious issue
    
    // Report deletion as an issue to the server
    try {
        await apiService.reportIssue({
            type: 'file_deleted',
            severity: 'critical',
            description: `File was deleted: ${fileInfo.name} from ${fileInfo.folder}`,
            file_path: fileInfo.path,
            file_name: fileInfo.name,
            device_id: store.get('deviceId'),
            agent_id: store.get('agentId'),
        });
    } catch (error) {
        console.error('Failed to report file deletion:', error);
    }
}

// Wrong destination detection handler
function handleWrongDestination(data) {
    console.log('⚠️ Wrong destination detected:', data.destPath);
    
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    // Get configured watched folders as suggestions
    const config = store.get('config', {});
    const suggestedPaths = (config.watchedFolders || []).map(f => 
        typeof f === 'object' ? f.path : f
    );
    
    mainWindow.webContents.send('wrong-destination', {
        destPath: data.destPath,
        filename: data.filename,
        suggestedPaths: suggestedPaths,
    });
    
    logger?.warn('Wrong destination detected', { destPath: data.destPath, filename: data.filename });
}

// Backup disk event handlers
function handleBackupDiskInserted(diskInfo) {
    console.log('💾 Backup disk inserted:', diskInfo);
    
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    mainWindow.webContents.send('backup-disk-inserted', diskInfo);
    logger?.info('Backup disk inserted', diskInfo);
}

function handleBackupDiskRemoved(diskInfo) {
    console.log('💾 Backup disk removed:', diskInfo);
    
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    mainWindow.webContents.send('backup-disk-removed', diskInfo);
    logger?.info('Backup disk removed', diskInfo);
}

// Audio analysis after file copy
async function analyzeFileAudio(fileInfo) {
    if (!audioAnalyzer || !fileInfo.path) return;
    
    try {
        const result = await audioAnalyzer.analyze(fileInfo.path);
        
        if (result.hasIssue) {
            mainWindow?.webContents?.send('audio-issue-detected', {
                issue: result.issue,
                filename: fileInfo.name,
                filepath: fileInfo.path,
                details: result.details,
            });
            logger?.warn('Audio issue detected', { file: fileInfo.name, issue: result.issue });
        }
    } catch (error) {
        // Silent fail - audio analysis is assistive, not critical
        console.error('Audio analysis failed:', error.message);
    }
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
        logger.info('Registering agent', data);
        const response = await apiService.registerAgent(data);
        logger.info('Agent registered successfully', response);
        store.set('isRegistered', true);
        store.set('agentId', response.agent_id);
        store.set('deviceId', data.device_id);
        
        // Start services in background, don't block registration
        startServices().catch(err => {
            logger.error('Failed to start services after registration', err);
        });
        
        return response;
    } catch (error) {
        logger.error('Agent registration failed', { 
            message: error.message, 
            response: error.response?.data,
            status: error.response?.status 
        });
        const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
        throw new Error(errorMessage);
    }
});

ipcMain.handle('get-groups', async (event) => {
    try {
        // Ensure apiService is initialized
        if (!apiService) {
            const config = store.get('config', {});
            apiService = new ApiService(config.apiUrl || 'https://api.gate1.cloud/api');
        }
        const response = await apiService.getGroups();
        logger.info('Groups fetched', response);
        return response.groups || [];
    } catch (error) {
        logger.error('Failed to fetch groups', { message: error.message, response: error.response?.data });
        return [];
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
        // Ensure apiService is initialized
        if (!apiService) {
            const config = store.get('config', {});
            apiService = new ApiService(config.apiUrl || 'https://api.gate1.cloud/api');
        }
        
        const response = await apiService.login(credentials);
        store.set('token', response.authorization.token);
        store.set('user', response.user);
        apiService.setToken(response.authorization.token);
        logger?.info('Login successful', { user: response.user?.email });
        return response;
    } catch (error) {
        logger?.error('Login failed', { message: error.message, response: error.response?.data });
        const errorMessage = error.response?.data?.message || error.message || 'Login failed';
        throw new Error(errorMessage);
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

// Decision logging handlers
ipcMain.handle('log-wrong-dest-decision', async (event, data) => {
    logger?.warn('Wrong destination decision', data);
    try {
        await apiService?.reportIssue({
            type: 'wrong_destination',
            severity: 'low',
            description: `User continued with non-standard destination`,
            decision: data.decision,
            device_id: store.get('deviceId'),
            agent_id: store.get('agentId'),
        });
    } catch (e) {
        // Silent fail
    }
    return { success: true };
});

ipcMain.handle('log-audio-issue-decision', async (event, data) => {
    logger?.info('Audio issue decision', data);
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
    
    // Stop all services to prevent memory leaks
    try {
        sdCardService?.stop();
        fileWatcherService?.stop();
        mediaDeletionService?.stop();
        backupService?.stop();
        logger?.info('All services stopped');
    } catch (e) {
        console.error('Error stopping services:', e);
    }
    
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
    try {
        store.set('config', config);
        logger?.info('Settings saved', config);
        
        // Update file watcher with new folders
        if (fileWatcherService && config.watchedFolders) {
            fileWatcherService.updateFolders(config.watchedFolders);
        }
        
        // Handle auto-start setting
        if (process.platform === 'win32') {
            try {
                app.setLoginItemSettings({
                    openAtLogin: config.autoStart || false,
                    path: process.execPath,
                });
            } catch (e) {
                logger?.error('Failed to set login item settings', e);
            }
        }
        
        return { success: true };
    } catch (error) {
        logger?.error('Failed to save settings', error);
        throw error;
    }
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

ipcMain.handle('ping-server', async () => {
    if (!apiService) {
        return { online: false, latency: null };
    }
    return await apiService.ping();
});

// Minimize to tray setting
ipcMain.handle('get-minimize-to-tray', () => {
    return store.get('minimizeToTray', true);
});

ipcMain.handle('set-minimize-to-tray', (event, value) => {
    store.set('minimizeToTray', value);
    return { success: true };
});

// Diagnostic export for support
ipcMain.handle('export-diagnostics', async () => {
    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            app: {
                version: app.getVersion(),
                name: app.getName(),
                platform: process.platform,
                arch: process.arch,
                electron: process.versions.electron,
                node: process.versions.node,
            },
            config: {
                apiUrl: store.get('config.apiUrl'),
                watchedFolders: store.get('config.watchedFolders', []).length,
                autoStart: store.get('config.autoStart'),
            },
            state: {
                isRegistered: store.get('isRegistered'),
                hasToken: !!store.get('token'),
                deviceId: store.get('deviceId'),
                agentId: store.get('agentId'),
            },
            services: {
                sdCardService: sdCardService ? 'running' : 'stopped',
                fileWatcherService: fileWatcherService ? 'running' : 'stopped',
                activeSessions: sessionService?.getAllActiveSessions()?.length || 0,
                pendingSync: apiService?.pendingSync?.length || 0,
                isOnline: apiService?.isOnline || false,
            },
            logs: await logger?.getRecentLogs(200) || [],
        };

        const exportPath = path.join(app.getPath('desktop'), `gate1-diagnostics-${Date.now()}.json`);
        const fs = require('fs').promises;
        await fs.writeFile(exportPath, JSON.stringify(diagnostics, null, 2));
        
        shell.showItemInFolder(exportPath);
        logger?.info('Diagnostics exported', { path: exportPath });
        
        return { success: true, path: exportPath };
    } catch (error) {
        logger?.error('Failed to export diagnostics', error);
        return { success: false, error: error.message };
    }
});

// Forget device / reset registration
ipcMain.handle('forget-device', async () => {
    try {
        // Stop all services
        sdCardService?.stop();
        fileWatcherService?.stop();
        mediaDeletionService?.stop();
        
        // Set user offline if possible
        try {
            if (apiService && store.get('token')) {
                await apiService.setUserOffline();
            }
        } catch (e) {
            // Ignore - might be offline
        }
        
        // Clear all stored data
        store.delete('token');
        store.delete('user');
        store.delete('deviceId');
        store.delete('agentId');
        store.delete('isRegistered');
        store.delete('currentEventId');
        store.delete('sessions');
        
        logger?.info('Device forgotten - registration cleared');
        
        return { success: true };
    } catch (error) {
        logger?.error('Failed to forget device', error);
        return { success: false, error: error.message };
    }
});

// Get sync queue status
ipcMain.handle('get-sync-status', () => {
    return {
        pendingCount: apiService?.pendingSync?.length || 0,
        isOnline: apiService?.isOnline || false,
        pending: apiService?.pendingSync || [],
    };
});

// Manual sync queue processing
ipcMain.handle('process-sync-queue', async () => {
    if (!apiService) return { processed: 0, failed: 0 };
    return await apiService.processSyncQueue();
});

// Update API URL
ipcMain.handle('update-api-url', async (event, newUrl) => {
    try {
        store.set('config.apiUrl', newUrl);
        
        // Reinitialize API service with new URL
        if (apiService) {
            apiService.baseUrl = newUrl;
            apiService.client.defaults.baseURL = newUrl;
        }
        
        logger?.info('API URL updated', { url: newUrl });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
