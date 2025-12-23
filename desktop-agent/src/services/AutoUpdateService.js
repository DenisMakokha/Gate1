const { autoUpdater } = require('electron-updater');
const { app, dialog, BrowserWindow } = require('electron');

class AutoUpdateService {
    constructor(logger) {
        this.logger = logger;
        this.updateAvailable = false;
        this.updateDownloaded = false;
        this.updateInfo = null;
        
        this.setupAutoUpdater();
    }

    setupAutoUpdater() {
        // Configure auto-updater
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('checking-for-update', () => {
            this.logger?.info('Checking for updates...');
            this.sendStatusToWindow('checking');
        });

        autoUpdater.on('update-available', (info) => {
            this.logger?.info('Update available', info);
            this.updateAvailable = true;
            this.updateInfo = info;
            this.sendStatusToWindow('available', info);
            
            // Prompt user to download
            this.promptForUpdate(info);
        });

        autoUpdater.on('update-not-available', (info) => {
            this.logger?.info('No updates available');
            this.sendStatusToWindow('not-available');
        });

        autoUpdater.on('error', (err) => {
            this.logger?.error('Auto-updater error', err.message);
            this.sendStatusToWindow('error', err.message);
        });

        autoUpdater.on('download-progress', (progress) => {
            const percent = Math.round(progress.percent);
            this.logger?.info(`Download progress: ${percent}%`);
            this.sendStatusToWindow('downloading', { percent });
        });

        autoUpdater.on('update-downloaded', (info) => {
            this.logger?.info('Update downloaded', info);
            this.updateDownloaded = true;
            this.sendStatusToWindow('downloaded', info);
            
            // Prompt user to install
            this.promptForInstall(info);
        });
    }

    sendStatusToWindow(status, data = null) {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
            win.webContents.send('update-status', { status, data });
        });
    }

    async checkForUpdates() {
        try {
            this.logger?.info('Manually checking for updates');
            await autoUpdater.checkForUpdates();
        } catch (error) {
            this.logger?.error('Failed to check for updates', error.message);
        }
    }

    async downloadUpdate() {
        if (!this.updateAvailable) {
            this.logger?.warn('No update available to download');
            return;
        }

        try {
            this.logger?.info('Starting update download');
            await autoUpdater.downloadUpdate();
        } catch (error) {
            this.logger?.error('Failed to download update', error.message);
        }
    }

    installUpdate() {
        if (!this.updateDownloaded) {
            this.logger?.warn('No update downloaded to install');
            return;
        }

        this.logger?.info('Installing update and restarting');
        autoUpdater.quitAndInstall(false, true);
    }

    async promptForUpdate(info) {
        const result = await dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: `A new version (${info.version}) is available!`,
            detail: 'Would you like to download it now?',
            buttons: ['Download', 'Later'],
            defaultId: 0,
            cancelId: 1,
        });

        if (result.response === 0) {
            this.downloadUpdate();
        }
    }

    async promptForInstall(info) {
        const result = await dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded`,
            detail: 'The update will be installed when you restart the application. Restart now?',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
            cancelId: 1,
        });

        if (result.response === 0) {
            this.installUpdate();
        }
    }

    getUpdateStatus() {
        return {
            available: this.updateAvailable,
            downloaded: this.updateDownloaded,
            info: this.updateInfo,
        };
    }
}

module.exports = { AutoUpdateService };
