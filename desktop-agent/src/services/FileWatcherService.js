const { EventEmitter } = require('events');
const chokidar = require('chokidar');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// Unsafe destination patterns
const UNSAFE_DESTINATIONS = [
    'Desktop',
    'Downloads', 
    'Temp',
    'AppData',
    'tmp',
    'Recycle',
    '$Recycle',
    'RECYCLER'
];

class FileWatcherService extends EventEmitter {
    constructor(watchedFolders = []) {
        super();
        this.watchedFolders = watchedFolders;
        this.watchers = [];
        this.fileStates = new Map();
        this.copyOperations = new Map();
        this.recentlyRemoved = new Map(); // Track removed files for rename detection
        this.warnedDestinations = new Set(); // Track already warned destinations
        
        // Batch processing for performance
        this.pendingEvents = [];
        this.batchTimeout = null;
        this.batchDelay = 2000; // Process events every 2 seconds
    }

    // Queue event for batch processing
    queueEvent(type, data) {
        this.pendingEvents.push({ type, data, timestamp: Date.now() });
        
        // Set up batch processing if not already scheduled
        if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(() => this.processBatch(), this.batchDelay);
        }
    }

    // Process queued events in batch
    processBatch() {
        this.batchTimeout = null;
        
        if (this.pendingEvents.length === 0) return;
        
        const events = [...this.pendingEvents];
        this.pendingEvents = [];
        
        // Group events by type
        const grouped = events.reduce((acc, event) => {
            if (!acc[event.type]) acc[event.type] = [];
            acc[event.type].push(event.data);
            return acc;
        }, {});
        
        // Emit batch events
        for (const [type, items] of Object.entries(grouped)) {
            if (items.length === 1) {
                this.emit(type, items[0]);
            } else {
                this.emit(`${type}-batch`, items);
                // Also emit individual events for backward compatibility
                items.forEach(item => this.emit(type, item));
            }
        }
    }

    async start() {
        console.log('FileWatcherService started');
        
        for (const folder of this.watchedFolders) {
            try {
                await fs.access(folder.path);
                await this.watchFolder(folder);
            } catch (e) {
                console.warn(`Folder not accessible: ${folder.path}`);
            }
        }
    }

    stop() {
        // Clear batch timeout
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        
        // Process any remaining events
        if (this.pendingEvents.length > 0) {
            this.processBatch();
        }
        
        for (const watcher of this.watchers) {
            watcher.close();
        }
        this.watchers = [];
    }

    async updateFolders(newFolders) {
        // Stop existing watchers
        this.stop();
        this.watchedFolders = newFolders || [];
        
        // Start watching new folders
        for (const folder of this.watchedFolders) {
            try {
                await fs.access(folder.path);
                await this.watchFolder(folder);
            } catch (e) {
                console.warn(`Folder not accessible: ${folder.path}`);
            }
        }
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

        try {
            const stats = await fs.stat(filePath);
            const checksum = await this.calculateChecksum(filePath, stats.size);
            
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
                // Check for wrong destination
                this.checkDestination(filePath, fileInfo.name);
                
                this.emit('file-copied', {
                    ...fileInfo,
                    sourcePath: copyOp.sourcePath,
                    sourceDevice: copyOp.sourceDevice,
                });
            } else {
                // Also check destination for non-copy adds
                this.checkDestination(filePath, fileInfo.name);
                this.emit('file-added', fileInfo);
            }
        } catch (err) {
            console.error(`Error handling file added ${filePath}:`, err.message);
        }
    }

    async handleFileChanged(filePath, folder) {
        const oldState = this.fileStates.get(filePath);
        const newName = path.basename(filePath);
        
        if (oldState && oldState.name !== newName) {
            try {
                // File was renamed
                const stats = await fs.stat(filePath);
                const checksum = await this.calculateChecksum(filePath, stats.size);
                
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
            } catch (err) {
                console.error(`Error handling file changed ${filePath}:`, err.message);
            }
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
            
            // Check after 2 seconds if this was a rename or actual deletion
            setTimeout(() => {
                const stillInRemoved = this.recentlyRemoved.get(fileState.checksum);
                if (stillInRemoved) {
                    // File was not renamed - this is a DELETION (flag it!)
                    this.recentlyRemoved.delete(fileState.checksum);
                    this.emit('file-deleted', {
                        path: filePath,
                        name: fileState.name,
                        folder: fileState.folder,
                        size: fileState.size,
                        deletedAt: new Date().toISOString(),
                    });
                    console.log(`⚠️ FILE DELETED: ${fileState.name}`);
                }
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

    async calculateChecksum(filePath, fileSize = 0) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            
            // For large files (>100MB), use partial checksum for performance
            // Read first 1MB + last 1MB + size for quick fingerprint
            const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
            const CHUNK_SIZE = 1024 * 1024; // 1MB
            
            if (fileSize > LARGE_FILE_THRESHOLD) {
                // Quick partial checksum for large files
                const fd = fsSync.openSync(filePath, 'r');
                try {
                    const headBuffer = Buffer.alloc(CHUNK_SIZE);
                    const tailBuffer = Buffer.alloc(CHUNK_SIZE);
                    
                    fsSync.readSync(fd, headBuffer, 0, CHUNK_SIZE, 0);
                    fsSync.readSync(fd, tailBuffer, 0, CHUNK_SIZE, fileSize - CHUNK_SIZE);
                    
                    hash.update(headBuffer);
                    hash.update(tailBuffer);
                    hash.update(fileSize.toString());
                    
                    resolve(hash.digest('hex'));
                } finally {
                    fsSync.closeSync(fd);
                }
            } else {
                // Full checksum for smaller files
                const stream = fsSync.createReadStream(filePath);
                stream.on('data', (data) => hash.update(data));
                stream.on('end', () => resolve(hash.digest('hex')));
                stream.on('error', reject);
            }
        });
    }

    async addWatchedFolder(folder) {
        this.watchedFolders.push(folder);
        try {
            await fs.access(folder.path);
            await this.watchFolder(folder);
        } catch (e) {
            console.warn(`Folder not accessible: ${folder.path}`);
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

    // Check if destination is unsafe and emit warning
    checkDestination(filePath, filename) {
        const dirPath = path.dirname(filePath);
        
        // Skip if already warned about this directory
        if (this.warnedDestinations.has(dirPath)) {
            return;
        }
        
        // Check against unsafe patterns
        const isUnsafe = UNSAFE_DESTINATIONS.some(unsafe => 
            dirPath.toLowerCase().includes(unsafe.toLowerCase())
        );
        
        if (isUnsafe) {
            this.warnedDestinations.add(dirPath);
            this.emit('wrong-destination', {
                destPath: dirPath,
                filename: filename,
            });
            console.log(`⚠️ Unsafe destination detected: ${dirPath}`);
        }
    }

    // Check if path is from SD card (removable drive)
    isFromSDCard(filePath) {
        if (process.platform === 'win32') {
            // Check if drive letter is typical for removable (E:, F:, G:, etc.)
            const driveLetter = filePath.charAt(0).toUpperCase();
            return 'EFGHIJKLMNOP'.includes(driveLetter);
        } else {
            // macOS/Linux - check /Volumes or /media
            return filePath.startsWith('/Volumes/') || filePath.startsWith('/media/');
        }
    }

    // Clear warned destinations (e.g., when session ends)
    clearWarnedDestinations() {
        this.warnedDestinations.clear();
    }
}

module.exports = { FileWatcherService };
