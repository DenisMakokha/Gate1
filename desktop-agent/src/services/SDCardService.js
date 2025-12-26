const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class SDCardService extends EventEmitter {
    constructor() {
        super();
        this.mountedCards = new Map();
        this.checkInterval = null;
        this.isScanning = false;
        this.driveCache = new Map(); // Cache drive type results
    }

    async start() {
        console.log('SDCardService started');
        await this.scanForCards();
        // Scan every 5 seconds (reduced from 3s for performance)
        this.checkInterval = setInterval(() => this.scanForCards(), 5000);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async scanForCards() {
        // Prevent concurrent scans
        if (this.isScanning) return;
        this.isScanning = true;
        
        try {
            const drives = await this.getRemovableDrives();
            const currentPaths = new Set(drives.map(d => d.path));
            
            // Check for new cards
            for (const drive of drives) {
                if (!this.mountedCards.has(drive.path)) {
                    try {
                        const sdInfo = await this.getSDCardInfo(drive);
                        this.mountedCards.set(drive.path, sdInfo);
                        this.emit('sd-inserted', sdInfo);
                    } catch (err) {
                        console.error(`Error getting SD card info for ${drive.path}:`, err.message);
                    }
                }
            }
            
            // Check for removed cards
            for (const [mountPath, sdInfo] of this.mountedCards) {
                if (!currentPaths.has(mountPath)) {
                    this.mountedCards.delete(mountPath);
                    this.driveCache.delete(mountPath); // Clear cache
                    this.emit('sd-removed', sdInfo);
                }
            }
        } catch (error) {
            console.error('Error scanning for SD cards:', error.message);
        } finally {
            this.isScanning = false;
        }
    }

    async getRemovableDrives() {
        const drives = [];
        
        if (process.platform === 'win32') {
            // Use WMI to get actual removable drives
            try {
                const wmicOutput = execSync(
                    'wmic logicaldisk where "DriveType=2" get DeviceID,VolumeName,Size /format:csv',
                    { encoding: 'utf8', timeout: 5000, windowsHide: true }
                ).trim();
                
                const lines = wmicOutput.split('\n').filter(l => l.trim() && !l.includes('Node'));
                for (const line of lines) {
                    const parts = line.split(',');
                    if (parts.length >= 2) {
                        const letter = parts[1]?.trim();
                        if (letter && /^[A-Z]:$/.test(letter)) {
                            const drivePath = `${letter}\\`;
                            // Quick check if drive is accessible
                            try {
                                await fs.access(drivePath);
                                drives.push({ path: drivePath, letter: letter.charAt(0) });
                            } catch (e) {
                                // Drive not accessible
                            }
                        }
                    }
                }
            } catch (e) {
                // Fallback: check common removable drive letters
                const letters = 'EFGHIJ'.split(''); // Limit to common removable letters
                for (const letter of letters) {
                    const drivePath = `${letter}:\\`;
                    try {
                        await fs.access(drivePath);
                        if (await this.isRemovableDrive(drivePath)) {
                            drives.push({ path: drivePath, letter });
                        }
                    } catch (e) {
                        // Drive doesn't exist
                    }
                }
            }
        } else {
            // macOS/Linux: Check /Volumes or /media
            const volumesPath = process.platform === 'darwin' ? '/Volumes' : '/media';
            try {
                const volumes = await fs.readdir(volumesPath);
                for (const volume of volumes) {
                    if (volume.startsWith('.')) continue; // Skip hidden
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

    async isRemovableDrive(drivePath) {
        // Check cache first
        if (this.driveCache.has(drivePath)) {
            return this.driveCache.get(drivePath);
        }
        
        try {
            // Check for DCIM folder (camera SD card indicator)
            const dcimPath = path.join(drivePath, 'DCIM');
            const privateDir = path.join(drivePath, 'PRIVATE');
            
            let isRemovable = false;
            try {
                await fs.access(dcimPath);
                isRemovable = true;
            } catch (e) {
                try {
                    await fs.access(privateDir);
                    isRemovable = true;
                } catch (e2) {
                    // Not a camera SD card - skip
                    isRemovable = false;
                }
            }
            
            this.driveCache.set(drivePath, isRemovable);
            return isRemovable;
        } catch (e) {
            return false;
        }
    }

    async getSDCardInfo(drive) {
        const hardwareId = await this.getHardwareId(drive.path);
        const fsUuid = await this.getFilesystemUUID(drive.path);
        const files = await this.scanVideoFiles(drive.path);
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);

        return {
            hardwareId,
            fsUuid,
            mountPath: drive.path,
            driveLetter: drive.letter || drive.name,
            files,
            fileCount: files.length,
            totalSizeBytes: totalSize,
            detectedAt: new Date().toISOString(),
        };
    }

    async getHardwareId(drivePath) {
        try {
            if (process.platform === 'win32') {
                // Use volume serial number on Windows - this is consistent for the same SD card
                const output = execSync(`vol ${drivePath.charAt(0)}:`, { 
                    encoding: 'utf8', 
                    timeout: 3000,
                    windowsHide: true 
                });
                const match = output.match(/Serial Number is ([A-F0-9-]+)/i);
                if (match) {
                    return `SD-${match[1].replace(/-/g, '')}`;
                }
            } else {
                // macOS/Linux: use disk identifier
                const output = execSync(`diskutil info "${drivePath}" 2>/dev/null | grep "Volume UUID"`, {
                    encoding: 'utf8',
                    timeout: 3000
                });
                const match = output.match(/Volume UUID:\s+([A-F0-9-]+)/i);
                if (match) {
                    return `SD-${match[1].replace(/-/g, '').substring(0, 12)}`;
                }
            }
        } catch (e) {
            // Fallback - use drive letter/path as stable identifier
        }
        
        // Fallback: hash based on drive path only (stable, no Date.now)
        const hash = crypto.createHash('md5');
        hash.update(drivePath);
        return `SD-${hash.digest('hex').substring(0, 12).toUpperCase()}`;
    }

    async getFilesystemUUID(drivePath) {
        try {
            if (process.platform === 'win32') {
                const output = execSync(`vol ${drivePath.charAt(0)}:`, { 
                    encoding: 'utf8', 
                    timeout: 3000,
                    windowsHide: true 
                });
                const match = output.match(/Serial Number is ([A-F0-9-]+)/i);
                if (match) {
                    return match[1];
                }
            }
        } catch (e) {
            // Fallback
        }
        
        const hash = crypto.createHash('sha256');
        hash.update(drivePath);
        return hash.digest('hex').substring(0, 16);
    }

    async scanVideoFiles(drivePath) {
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts'];
        const files = [];
        const maxDepth = 3; // Limit recursion depth for performance
        
        const scanDir = async (dirPath, depth = 0) => {
            if (depth > maxDepth) return;
            
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    if (entry.name.startsWith('.')) continue; // Skip hidden
                    
                    const fullPath = path.join(dirPath, entry.name);
                    
                    if (entry.isDirectory()) {
                        await scanDir(fullPath, depth + 1);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (videoExtensions.includes(ext)) {
                            try {
                                const stats = await fs.stat(fullPath);
                                files.push({
                                    name: entry.name,
                                    path: fullPath,
                                    relativePath: path.relative(drivePath, fullPath),
                                    size: stats.size,
                                    createdAt: stats.birthtime,
                                    modifiedAt: stats.mtime,
                                });
                            } catch (statErr) {
                                // Skip files we can't stat
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip directories we can't read
            }
        };
        
        await scanDir(drivePath);
        return files;
    }

    getMountedCard(hardwareId) {
        for (const [, sdInfo] of this.mountedCards) {
            if (sdInfo.hardwareId === hardwareId) {
                return sdInfo;
            }
        }
        return null;
    }

    getAllMountedCards() {
        return Array.from(this.mountedCards.values());
    }
}

module.exports = { SDCardService };
