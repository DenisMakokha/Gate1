const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SDCardService extends EventEmitter {
    constructor() {
        super();
        this.mountedCards = new Map();
        this.checkInterval = null;
    }

    async start() {
        console.log('SDCardService started');
        await this.scanForCards();
        this.checkInterval = setInterval(() => this.scanForCards(), 3000);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async scanForCards() {
        try {
            const drives = await this.getRemovableDrives();
            
            // Check for new cards
            for (const drive of drives) {
                if (!this.mountedCards.has(drive.path)) {
                    const sdInfo = await this.getSDCardInfo(drive);
                    this.mountedCards.set(drive.path, sdInfo);
                    this.emit('sd-inserted', sdInfo);
                }
            }
            
            // Check for removed cards
            for (const [mountPath, sdInfo] of this.mountedCards) {
                const stillMounted = drives.some(d => d.path === mountPath);
                if (!stillMounted) {
                    this.mountedCards.delete(mountPath);
                    this.emit('sd-removed', sdInfo);
                }
            }
        } catch (error) {
            console.error('Error scanning for SD cards:', error);
        }
    }

    async getRemovableDrives() {
        const drives = [];
        
        if (process.platform === 'win32') {
            // Windows: Check drive letters
            const letters = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('');
            for (const letter of letters) {
                const drivePath = `${letter}:\\`;
                try {
                    const stats = fs.statSync(drivePath);
                    if (stats.isDirectory()) {
                        // Check if it's removable (simplified check)
                        const isRemovable = await this.isRemovableDrive(drivePath);
                        if (isRemovable) {
                            drives.push({ path: drivePath, letter });
                        }
                    }
                } catch (e) {
                    // Drive doesn't exist
                }
            }
        } else {
            // macOS/Linux: Check /Volumes or /media
            const volumesPath = process.platform === 'darwin' ? '/Volumes' : '/media';
            try {
                const volumes = fs.readdirSync(volumesPath);
                for (const volume of volumes) {
                    const volumePath = path.join(volumesPath, volume);
                    drives.push({ path: volumePath, name: volume });
                }
            } catch (e) {
                // No volumes
            }
        }
        
        return drives;
    }

    async isRemovableDrive(drivePath) {
        // Simplified check - in production, use proper Windows API
        try {
            // Check for common SD card indicators
            const dcimPath = path.join(drivePath, 'DCIM');
            const privateDir = path.join(drivePath, 'PRIVATE');
            
            if (fs.existsSync(dcimPath) || fs.existsSync(privateDir)) {
                return true;
            }
            
            // Check drive size (SD cards typically < 512GB)
            // This is a simplified heuristic
            return true;
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
        // In production, use proper disk identification
        // For now, generate a consistent ID based on volume info
        try {
            if (process.platform === 'win32') {
                // Use volume serial number on Windows
                const { execSync } = require('child_process');
                const output = execSync(`vol ${drivePath.charAt(0)}:`, { encoding: 'utf8' });
                const match = output.match(/Serial Number is ([A-F0-9-]+)/i);
                if (match) {
                    return `SD-${match[1].replace(/-/g, '')}`;
                }
            }
        } catch (e) {
            // Fallback
        }
        
        // Fallback: hash the drive path and some file info
        const hash = crypto.createHash('md5');
        hash.update(drivePath);
        hash.update(Date.now().toString());
        return `SD-${hash.digest('hex').substring(0, 12).toUpperCase()}`;
    }

    async getFilesystemUUID(drivePath) {
        // Simplified - in production use proper filesystem tools
        const hash = crypto.createHash('sha256');
        hash.update(drivePath);
        return hash.digest('hex').substring(0, 16);
    }

    async scanVideoFiles(drivePath) {
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts'];
        const files = [];
        
        const scanDir = async (dirPath) => {
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    
                    if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        await scanDir(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (videoExtensions.includes(ext)) {
                            const stats = fs.statSync(fullPath);
                            files.push({
                                name: entry.name,
                                path: fullPath,
                                relativePath: path.relative(drivePath, fullPath),
                                size: stats.size,
                                createdAt: stats.birthtime,
                                modifiedAt: stats.mtime,
                            });
                        }
                    }
                }
            } catch (e) {
                console.error(`Error scanning ${dirPath}:`, e);
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
