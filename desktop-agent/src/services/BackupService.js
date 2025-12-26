const { EventEmitter } = require('events');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

/**
 * BackupService - Handles backup disk detection and verification
 * Lightweight implementation using file headers and checksums
 */
class BackupService extends EventEmitter {
    constructor(store, logger) {
        super();
        this.store = store;
        this.logger = logger;
        this.registeredBackupDisks = new Map();
        this.currentBackupDisk = null;
        this.checkInterval = null;
        this.isScanning = false;
        
        // Load registered backup disks from store
        this.loadRegisteredDisks();
    }

    loadRegisteredDisks() {
        try {
            const disks = this.store.get('backupDisks', {});
            for (const [id, disk] of Object.entries(disks)) {
                this.registeredBackupDisks.set(id, disk);
            }
            this.logger?.info('Loaded registered backup disks', { count: this.registeredBackupDisks.size });
        } catch (e) {
            this.logger?.error('Failed to load backup disks', e.message);
        }
    }

    async start() {
        this.logger?.info('BackupService started');
        await this.scanForBackupDisks();
        // Scan every 10 seconds
        this.checkInterval = setInterval(() => this.scanForBackupDisks(), 10000);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async scanForBackupDisks() {
        if (this.isScanning) return;
        this.isScanning = true;

        try {
            const drives = await this.getExternalDrives();
            
            for (const drive of drives) {
                const diskId = await this.getDiskId(drive.path);
                
                // Check if this is a registered backup disk
                if (this.registeredBackupDisks.has(diskId)) {
                    if (!this.currentBackupDisk || this.currentBackupDisk.id !== diskId) {
                        this.currentBackupDisk = {
                            id: diskId,
                            path: drive.path,
                            name: drive.name || 'Backup Drive',
                            ...this.registeredBackupDisks.get(diskId),
                        };
                        this.emit('backup-disk-inserted', this.currentBackupDisk);
                        this.logger?.info('Backup disk detected', { id: diskId, path: drive.path });
                    }
                    break;
                }
                
                // Check for backup marker file (alternative detection)
                const markerPath = path.join(drive.path, '.gate1_backup');
                try {
                    await fs.access(markerPath);
                    if (!this.currentBackupDisk || this.currentBackupDisk.id !== diskId) {
                        // Auto-register this disk
                        await this.registerBackupDisk(diskId, drive.path, drive.name);
                        this.currentBackupDisk = {
                            id: diskId,
                            path: drive.path,
                            name: drive.name || 'Backup Drive',
                        };
                        this.emit('backup-disk-inserted', this.currentBackupDisk);
                    }
                } catch (e) {
                    // No marker file - not a backup disk
                }
            }

            // Check if current backup disk was removed
            if (this.currentBackupDisk) {
                const stillPresent = drives.some(d => d.path === this.currentBackupDisk.path);
                if (!stillPresent) {
                    const removed = this.currentBackupDisk;
                    this.currentBackupDisk = null;
                    this.emit('backup-disk-removed', removed);
                    this.logger?.info('Backup disk removed', { id: removed.id });
                }
            }
        } catch (error) {
            this.logger?.error('Error scanning for backup disks', error.message);
        } finally {
            this.isScanning = false;
        }
    }

    async getExternalDrives() {
        const drives = [];
        
        if (process.platform === 'win32') {
            try {
                // Use WMI to get external drives (USB/External)
                const wmicOutput = execSync(
                    'wmic logicaldisk where "DriveType=2 or DriveType=3" get DeviceID,VolumeName,Size,DriveType /format:csv',
                    { encoding: 'utf8', timeout: 5000, windowsHide: true }
                ).trim();
                
                const lines = wmicOutput.split('\n').filter(l => l.trim() && !l.includes('Node'));
                for (const line of lines) {
                    const parts = line.split(',');
                    if (parts.length >= 4) {
                        const letter = parts[1]?.trim();
                        const driveType = parseInt(parts[2]) || 3;
                        const name = parts[4]?.trim() || 'External Drive';
                        
                        // DriveType 2 = Removable, skip system drives (C:)
                        if (letter && /^[D-Z]:$/.test(letter) && driveType !== 3) {
                            const drivePath = `${letter}\\`;
                            try {
                                await fs.access(drivePath);
                                drives.push({ path: drivePath, letter: letter.charAt(0), name });
                            } catch (e) {
                                // Drive not accessible
                            }
                        }
                    }
                }
            } catch (e) {
                // Fallback to checking common letters
                const letters = 'DEFGHIJ'.split('');
                for (const letter of letters) {
                    const drivePath = `${letter}:\\`;
                    try {
                        await fs.access(drivePath);
                        drives.push({ path: drivePath, letter, name: `Drive ${letter}` });
                    } catch (e) {
                        // Drive doesn't exist
                    }
                }
            }
        } else {
            // macOS/Linux
            const volumesPath = process.platform === 'darwin' ? '/Volumes' : '/media';
            try {
                const volumes = await fs.readdir(volumesPath);
                for (const volume of volumes) {
                    if (volume.startsWith('.') || volume === 'Macintosh HD') continue;
                    const volumePath = path.join(volumesPath, volume);
                    try {
                        const stat = await fs.stat(volumePath);
                        if (stat.isDirectory()) {
                            drives.push({ path: volumePath, name: volume });
                        }
                    } catch (e) {
                        // Skip inaccessible
                    }
                }
            } catch (e) {
                // No volumes
            }
        }
        
        return drives;
    }

    async getDiskId(drivePath) {
        try {
            if (process.platform === 'win32') {
                const output = execSync(`vol ${drivePath.charAt(0)}:`, { 
                    encoding: 'utf8', 
                    timeout: 3000,
                    windowsHide: true 
                });
                const match = output.match(/Serial Number is ([A-F0-9-]+)/i);
                if (match) {
                    return `BACKUP-${match[1].replace(/-/g, '')}`;
                }
            }
        } catch (e) {
            // Fallback
        }
        
        const hash = crypto.createHash('md5');
        hash.update(drivePath);
        return `BACKUP-${hash.digest('hex').substring(0, 12).toUpperCase()}`;
    }

    async registerBackupDisk(diskId, diskPath, name) {
        const diskInfo = {
            id: diskId,
            name: name || 'Backup Drive',
            registeredAt: new Date().toISOString(),
        };
        
        this.registeredBackupDisks.set(diskId, diskInfo);
        
        // Save to store
        const disks = this.store.get('backupDisks', {});
        disks[diskId] = diskInfo;
        this.store.set('backupDisks', disks);
        
        // Create marker file
        try {
            const markerPath = path.join(diskPath, '.gate1_backup');
            await fs.writeFile(markerPath, JSON.stringify(diskInfo, null, 2));
        } catch (e) {
            this.logger?.warn('Could not create backup marker file', e.message);
        }
        
        this.logger?.info('Backup disk registered', diskInfo);
        return diskInfo;
    }

    /**
     * Verify backup integrity by comparing checksums
     */
    async verifyBackup(sourceFolder, backupFolder) {
        this.logger?.info('Starting backup verification', { sourceFolder, backupFolder });
        
        try {
            const sourceFiles = await this.scanFolder(sourceFolder);
            const backupFiles = await this.scanFolder(backupFolder);
            
            const total = sourceFiles.length;
            let matched = 0;
            let failed = 0;
            const issues = [];
            
            this.emit('backup-verify-start', { total });
            
            for (let i = 0; i < sourceFiles.length; i++) {
                const sourceFile = sourceFiles[i];
                const relativePath = path.relative(sourceFolder, sourceFile.path);
                const backupPath = path.join(backupFolder, relativePath);
                
                this.emit('backup-verify-progress', { 
                    total, 
                    current: i + 1, 
                    status: `Checking ${sourceFile.name}...` 
                });
                
                try {
                    const backupStat = await fs.stat(backupPath);
                    
                    // Quick size check first
                    if (backupStat.size !== sourceFile.size) {
                        failed++;
                        issues.push({ file: relativePath, issue: 'size_mismatch' });
                        continue;
                    }
                    
                    // Checksum verification for video files
                    if (this.isVideoFile(sourceFile.name)) {
                        const sourceChecksum = await this.calculateChecksum(sourceFile.path, sourceFile.size);
                        const backupChecksum = await this.calculateChecksum(backupPath, backupStat.size);
                        
                        if (sourceChecksum === backupChecksum) {
                            matched++;
                        } else {
                            failed++;
                            issues.push({ file: relativePath, issue: 'checksum_mismatch' });
                        }
                    } else {
                        // For non-video files, size match is enough
                        matched++;
                    }
                } catch (e) {
                    failed++;
                    issues.push({ file: relativePath, issue: 'missing' });
                }
            }
            
            const success = failed === 0;
            
            this.emit('backup-verify-complete', { 
                success, 
                matched, 
                failed, 
                total,
                issues 
            });
            
            this.logger?.info('Backup verification complete', { success, matched, failed });
            
            return { success, matched, failed, issues };
        } catch (error) {
            this.logger?.error('Backup verification failed', error.message);
            this.emit('backup-verify-complete', { success: false, matched: 0, failed: 0, error: error.message });
            throw error;
        }
    }

    async scanFolder(folderPath) {
        const files = [];
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts'];
        
        const scan = async (dirPath) => {
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    if (entry.name.startsWith('.')) continue;
                    
                    const fullPath = path.join(dirPath, entry.name);
                    
                    if (entry.isDirectory()) {
                        await scan(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (videoExtensions.includes(ext)) {
                            const stats = await fs.stat(fullPath);
                            files.push({
                                name: entry.name,
                                path: fullPath,
                                size: stats.size,
                            });
                        }
                    }
                }
            } catch (e) {
                // Skip inaccessible directories
            }
        };
        
        await scan(folderPath);
        return files;
    }

    isVideoFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return ['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts'].includes(ext);
    }

    async calculateChecksum(filePath, fileSize = 0) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            
            // For large files, use partial checksum
            const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
            const CHUNK_SIZE = 1024 * 1024; // 1MB
            
            if (fileSize > LARGE_FILE_THRESHOLD) {
                try {
                    const fd = fsSync.openSync(filePath, 'r');
                    const headBuffer = Buffer.alloc(CHUNK_SIZE);
                    const tailBuffer = Buffer.alloc(CHUNK_SIZE);
                    
                    fsSync.readSync(fd, headBuffer, 0, CHUNK_SIZE, 0);
                    fsSync.readSync(fd, tailBuffer, 0, CHUNK_SIZE, fileSize - CHUNK_SIZE);
                    fsSync.closeSync(fd);
                    
                    hash.update(headBuffer);
                    hash.update(tailBuffer);
                    hash.update(String(fileSize));
                    
                    resolve(hash.digest('hex'));
                } catch (e) {
                    reject(e);
                }
            } else {
                const stream = fsSync.createReadStream(filePath);
                stream.on('data', chunk => hash.update(chunk));
                stream.on('end', () => resolve(hash.digest('hex')));
                stream.on('error', reject);
            }
        });
    }

    getCurrentBackupDisk() {
        return this.currentBackupDisk;
    }

    isBackupModeActive() {
        return this.currentBackupDisk !== null;
    }
}

module.exports = { BackupService };
