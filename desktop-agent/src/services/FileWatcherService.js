const { EventEmitter } = require('events');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileWatcherService extends EventEmitter {
    constructor(watchedFolders = []) {
        super();
        this.watchedFolders = watchedFolders;
        this.watchers = [];
        this.fileStates = new Map();
        this.copyOperations = new Map();
        this.recentlyRemoved = new Map(); // Track removed files for rename detection
    }

    async start() {
        console.log('FileWatcherService started');
        
        for (const folder of this.watchedFolders) {
            if (fs.existsSync(folder.path)) {
                await this.watchFolder(folder);
            }
        }
    }

    stop() {
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
    }

    async watchFolder(folder) {
        const watcher = chokidar.watch(folder.path, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100,
            },
            depth: folder.watchSubfolders ? undefined : 0,
        });

        watcher.on('add', async (filePath) => {
            await this.handleFileAdded(filePath, folder);
        });

        watcher.on('change', async (filePath) => {
            await this.handleFileChanged(filePath, folder);
        });

        watcher.on('unlink', (filePath) => {
            this.handleFileRemoved(filePath);
        });

        this.watchers.push(watcher);
        console.log(`Watching folder: ${folder.path} (${folder.type})`);
    }

    async handleFileAdded(filePath, folder) {
        const ext = path.extname(filePath).toLowerCase();
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts'];
        
        if (!videoExtensions.includes(ext)) {
            return;
        }

        const stats = fs.statSync(filePath);
        const checksum = await this.calculateChecksum(filePath);
        
        const fileInfo = {
            path: filePath,
            name: path.basename(filePath),
            folder: folder.path,
            folderType: folder.type,
            size: stats.size,
            checksum,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
        };

        // Check if this is a rename (file with same checksum was recently removed)
        const renameSource = this.detectRename(fileInfo);
        if (renameSource) {
            // This is a rename operation
            this.fileStates.set(filePath, fileInfo);
            this.emit('file-renamed', {
                ...fileInfo,
                oldName: renameSource.name,
                oldPath: renameSource.path,
                newName: fileInfo.name,
            });
            console.log(`File renamed: ${renameSource.name} -> ${fileInfo.name}`);
            return;
        }

        this.fileStates.set(filePath, fileInfo);

        // Check if this is a copy operation (file came from SD card)
        const copyOp = this.detectCopyOperation(fileInfo);
        if (copyOp) {
            this.emit('file-copied', {
                ...fileInfo,
                sourcePath: copyOp.sourcePath,
                sourceDevice: copyOp.sourceDevice,
            });
        } else {
            this.emit('file-added', fileInfo);
        }
    }

    async handleFileChanged(filePath, folder) {
        const oldState = this.fileStates.get(filePath);
        const newName = path.basename(filePath);
        
        if (oldState && oldState.name !== newName) {
            // File was renamed
            const stats = fs.statSync(filePath);
            const checksum = await this.calculateChecksum(filePath);
            
            const fileInfo = {
                path: filePath,
                oldName: oldState.name,
                newName,
                folder: folder.path,
                folderType: folder.type,
                size: stats.size,
                checksum,
            };

            this.fileStates.set(filePath, {
                ...oldState,
                name: newName,
                checksum,
            });

            this.emit('file-renamed', fileInfo);
        }
    }

    handleFileRemoved(filePath) {
        const fileState = this.fileStates.get(filePath);
        
        // Store removed file info for rename detection
        if (fileState) {
            this.recentlyRemoved.set(fileState.checksum, {
                ...fileState,
                removedAt: Date.now(),
            });
            
            // Clean up after 2 seconds (renames happen quickly)
            setTimeout(() => {
                this.recentlyRemoved.delete(fileState.checksum);
            }, 2000);
        }
        
        this.fileStates.delete(filePath);
        this.emit('file-removed', { path: filePath });
    }

    detectRename(newFileInfo) {
        // Check if a file with same size was recently removed (within 2 seconds)
        // We use size first for quick check, then verify with checksum
        for (const [checksum, removedFile] of this.recentlyRemoved) {
            const timeSinceRemoval = Date.now() - removedFile.removedAt;
            
            // Must be within 2 seconds and same size
            if (timeSinceRemoval < 2000 && removedFile.size === newFileInfo.size) {
                // Same folder = likely a rename
                if (removedFile.folder === newFileInfo.folder) {
                    // Verify checksum matches
                    if (checksum === newFileInfo.checksum) {
                        this.recentlyRemoved.delete(checksum);
                        return removedFile;
                    }
                }
            }
        }
        return null;
    }

    detectCopyOperation(fileInfo) {
        // Check if we have a pending copy operation matching this file
        for (const [sourceId, copyOp] of this.copyOperations) {
            if (copyOp.size === fileInfo.size && 
                copyOp.checksum === fileInfo.checksum) {
                this.copyOperations.delete(sourceId);
                return copyOp;
            }
        }
        return null;
    }

    registerCopySource(sourceInfo) {
        const sourceId = `${sourceInfo.path}-${sourceInfo.size}`;
        this.copyOperations.set(sourceId, {
            sourcePath: sourceInfo.path,
            sourceDevice: sourceInfo.device,
            size: sourceInfo.size,
            checksum: sourceInfo.checksum,
            registeredAt: Date.now(),
        });

        // Clean up old copy operations after 5 minutes
        setTimeout(() => {
            this.copyOperations.delete(sourceId);
        }, 300000);
    }

    async calculateChecksum(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    addWatchedFolder(folder) {
        this.watchedFolders.push(folder);
        if (fs.existsSync(folder.path)) {
            this.watchFolder(folder);
        }
    }

    removeWatchedFolder(folderPath) {
        const index = this.watchedFolders.findIndex(f => f.path === folderPath);
        if (index !== -1) {
            this.watchedFolders.splice(index, 1);
        }
    }

    getWatchedFolders() {
        return this.watchedFolders;
    }

    validateDestination(destPath, allowedWorkspaces) {
        // Check if destination is in an allowed workspace
        for (const workspace of allowedWorkspaces) {
            if (destPath.startsWith(workspace)) {
                return { valid: true };
            }
        }

        return {
            valid: false,
            message: 'Destination is not in a recommended working folder',
            suggestedPath: allowedWorkspaces[0] || null,
        };
    }
}

module.exports = { FileWatcherService };
