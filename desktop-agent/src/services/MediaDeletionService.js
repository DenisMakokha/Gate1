const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

/**
 * MediaDeletionService - Data Protection Compliance
 * 
 * Permanently deletes media files from editor's personal laptop after event ends.
 * Critical for preventing data breaches when editors leave with their devices.
 * 
 * Features:
 * - Stores event end date/time locally when files are copied
 * - Auto-deletes based on stored date even when FULLY OFFLINE
 * - No server connectivity required after initial session
 * - Searches watched folders + common locations + moved file detection
 * - Secure wipe (overwrites before delete)
 * - Full local audit trail
 * 
 * EXCLUDES: Backup disks (handled server-side)
 */
class MediaDeletionService {
    constructor(apiService, loggerService) {
        this.api = apiService;
        this.logger = loggerService;
        this.deviceId = null;
        this.watchedFolders = [];
        this.pendingTasksFile = path.join(app.getPath('userData'), 'pending-deletions.json');
        this.deletionAuditFile = path.join(app.getPath('userData'), 'deletion-audit.json');
        this.fileIndexFile = path.join(app.getPath('userData'), 'file-index.json');
        this.eventMetadataFile = path.join(app.getPath('userData'), 'event-metadata.json');
        this.trackedFilesFile = path.join(app.getPath('userData'), 'tracked-files.json');
        this.checkInterval = null;
        this.localCheckInterval = null;
    }

    setDeviceId(deviceId) {
        this.deviceId = deviceId;
    }

    setWatchedFolders(folders) {
        this.watchedFolders = folders.map(f => typeof f === 'object' ? f.path : f);
    }

    async start() {
        if (!this.deviceId) {
            this.logger.warn('MediaDeletionService: No device ID set, cannot start');
            return;
        }

        this.logger.info('MediaDeletionService: Starting deletion service');
        
        // Process local tasks and tracked files immediately (for offline deletions)
        await this.processLocalTasks();
        await this.processTrackedFiles();

        // Check server for new tasks every 30 minutes (only fetches for closed events)
        this.checkInterval = setInterval(() => {
            this.fetchServerTasks();
        }, 30 * 60 * 1000);

        // Process local queue AND tracked files every 1 minute
        // This handles both server tasks and fully offline auto-deletion
        this.localCheckInterval = setInterval(() => {
            this.processLocalTasks();
            this.processTrackedFiles(); // Offline auto-deletion based on stored event dates
        }, 60 * 1000);

        // Initial server fetch (if online)
        await this.fetchServerTasks();
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.localCheckInterval) {
            clearInterval(this.localCheckInterval);
            this.localCheckInterval = null;
        }
        this.logger.info('MediaDeletionService: Stopped');
    }

    /**
     * Fetch pending deletion tasks from server (only for closed events)
     */
    async fetchServerTasks() {
        try {
            const response = await this.api.getPendingDeletionTasks(this.deviceId);
            
            if (response.tasks && response.tasks.length > 0) {
                this.logger.info(`MediaDeletionService: Received ${response.tasks.length} deletion tasks from server`);
                
                // Cache ALL tasks locally for offline processing
                await this.cacheTasks(response.tasks);
            }
        } catch (error) {
            // Offline - local tasks will still process
            this.logger.warn('MediaDeletionService: Could not fetch server tasks (offline)', error.message);
        }
    }

    /**
     * Process locally cached tasks - runs even when offline
     * Checks scheduled_at datetime before executing
     * ENFORCES: Deletion only happens AFTER event has ended
     */
    async processLocalTasks() {
        try {
            const localTasks = await this.loadLocalTasks();
            
            if (localTasks.length === 0) {
                return;
            }

            const now = new Date();
            const remainingTasks = [];
            let processedCount = 0;

            for (const task of localTasks) {
                // ENFORCE: Event must have ended before ANY deletion
                const eventEndTime = new Date(task.event_end_datetime || task.event_end_date);
                if (eventEndTime && eventEndTime > now) {
                    // Event hasn't ended yet - NEVER delete before event closure
                    remainingTasks.push(task);
                    continue;
                }
                
                // Check if scheduled time has passed (specific date AND time)
                const scheduledAt = new Date(task.scheduled_at);
                
                if (scheduledAt <= now) {
                    // Event has ended AND scheduled time passed - safe to delete
                    const success = await this.executeDelete(task);
                    if (success) {
                        processedCount++;
                        await this.logAudit(task, 'deleted');
                    } else {
                        // Keep failed tasks for retry (max 3 attempts)
                        task.attempts = (task.attempts || 0) + 1;
                        if (task.attempts < 3) {
                            remainingTasks.push(task);
                        } else {
                            await this.logAudit(task, 'failed_max_attempts');
                        }
                    }
                } else {
                    // Not yet time - keep in queue
                    remainingTasks.push(task);
                }
            }

            if (processedCount > 0) {
                this.logger.info(`MediaDeletionService: Processed ${processedCount} deletion tasks`);
            }

            // Save remaining tasks
            await this.saveLocalTasks(remainingTasks);
        } catch (error) {
            this.logger.error('MediaDeletionService: Error processing local tasks', error);
        }
    }

    /**
     * Execute permanent file deletion
     */
    async executeDelete(task) {
        this.logger.info(`MediaDeletionService: Executing deletion for: ${task.filename || task.file_path}`);

        try {
            // Search for the file in all possible locations
            const foundPaths = await this.findAllFileLocations(task);
            
            if (foundPaths.length === 0) {
                // File not found anywhere - might already be deleted
                this.logger.info(`MediaDeletionService: File not found (may already be deleted): ${task.filename}`);
                await this.reportToServer(task.id, 'completed', 'File not found on device');
                return true;
            }

            // Permanently delete from ALL found locations
            let deletedCount = 0;
            for (const filePath of foundPaths) {
                try {
                    await this.permanentDelete(filePath);
                    deletedCount++;
                    this.logger.info(`MediaDeletionService: Permanently deleted: ${filePath}`);
                } catch (e) {
                    this.logger.error(`MediaDeletionService: Failed to delete ${filePath}:`, e.message);
                }
            }

            if (deletedCount > 0) {
                await this.reportToServer(task.id, 'completed', `Deleted from ${deletedCount} location(s)`);
                return true;
            }

            return false;
        } catch (error) {
            this.logger.error(`MediaDeletionService: Deletion failed for task ${task.id}:`, error);
            await this.reportToServer(task.id, 'failed', error.message);
            return false;
        }
    }

    /**
     * Find file in ALL possible locations (watched folders, common paths, moved files)
     */
    async findAllFileLocations(task) {
        const foundPaths = [];
        const filename = task.filename || path.basename(task.file_path);
        const fileSize = task.file_size;
        const fileChecksum = task.checksum;

        // 1. Check original path
        if (task.file_path) {
            if (await this.fileExists(task.file_path)) {
                foundPaths.push(task.file_path);
            }
        }

        // 2. Search watched folders (configured by user)
        for (const watchedFolder of this.watchedFolders) {
            const matches = await this.searchFolder(watchedFolder, filename, fileSize, fileChecksum);
            foundPaths.push(...matches);
        }

        // 3. Search common locations
        const homeDir = app.getPath('home');
        const commonLocations = [
            app.getPath('documents'),
            app.getPath('videos'),
            app.getPath('downloads'),
            app.getPath('desktop'),
            path.join(homeDir, 'Videos'),
            path.join(homeDir, 'Documents'),
            path.join(homeDir, 'Desktop'),
            path.join(homeDir, 'Movies'),
            path.join(app.getPath('documents'), 'Gate1'),
            path.join(app.getPath('videos'), 'Gate1'),
        ];

        for (const location of commonLocations) {
            const matches = await this.searchFolder(location, filename, fileSize, fileChecksum);
            foundPaths.push(...matches);
        }

        // 4. Check file index for moved files
        const indexedPath = await this.checkFileIndex(filename, fileChecksum);
        if (indexedPath && await this.fileExists(indexedPath)) {
            foundPaths.push(indexedPath);
        }

        // Remove duplicates
        return [...new Set(foundPaths)];
    }

    /**
     * Search a folder recursively for matching file
     */
    async searchFolder(folderPath, filename, expectedSize, expectedChecksum) {
        const matches = [];
        
        try {
            await fs.access(folderPath);
        } catch {
            return matches; // Folder doesn't exist
        }

        const searchRecursive = async (dir, depth = 0) => {
            if (depth > 3) return; // Limit depth to avoid infinite loops
            
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    if (entry.name.startsWith('.')) continue;
                    
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        await searchRecursive(fullPath, depth + 1);
                    } else if (entry.isFile()) {
                        // Match by filename
                        if (entry.name === filename) {
                            // Verify by size if available
                            if (expectedSize) {
                                const stats = await fs.stat(fullPath);
                                if (stats.size === expectedSize) {
                                    matches.push(fullPath);
                                }
                            } else {
                                matches.push(fullPath);
                            }
                        }
                        // Also match by checksum if filename was changed
                        else if (expectedChecksum && this.isVideoFile(entry.name)) {
                            const checksum = await this.quickChecksum(fullPath);
                            if (checksum === expectedChecksum) {
                                matches.push(fullPath);
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip inaccessible directories
            }
        };

        await searchRecursive(folderPath);
        return matches;
    }

    /**
     * Permanent file deletion (secure wipe for sensitive data)
     */
    async permanentDelete(filePath) {
        try {
            const stats = await fs.stat(filePath);
            
            // Overwrite file content before deletion (data protection)
            const fd = await fs.open(filePath, 'r+');
            const chunkSize = Math.min(1024 * 1024, stats.size); // 1MB chunks
            const zeros = Buffer.alloc(chunkSize, 0);
            
            let written = 0;
            while (written < stats.size) {
                const toWrite = Math.min(chunkSize, stats.size - written);
                await fd.write(zeros.slice(0, toWrite), 0, toWrite, written);
                written += toWrite;
            }
            
            await fd.sync();
            await fd.close();
            
            // Now delete the file
            await fs.unlink(filePath);
            
        } catch (error) {
            // Fallback to regular delete if secure wipe fails
            await fs.unlink(filePath);
        }
    }

    /**
     * Quick checksum for file matching (first + last 1MB)
     */
    async quickChecksum(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const hash = crypto.createHash('md5');
            
            const CHUNK = 1024 * 1024;
            const fd = fsSync.openSync(filePath, 'r');
            
            // Read first chunk
            const headBuffer = Buffer.alloc(Math.min(CHUNK, stats.size));
            fsSync.readSync(fd, headBuffer, 0, headBuffer.length, 0);
            hash.update(headBuffer);
            
            // Read last chunk if file is large enough
            if (stats.size > CHUNK * 2) {
                const tailBuffer = Buffer.alloc(CHUNK);
                fsSync.readSync(fd, tailBuffer, 0, CHUNK, stats.size - CHUNK);
                hash.update(tailBuffer);
            }
            
            fsSync.closeSync(fd);
            hash.update(String(stats.size));
            
            return hash.digest('hex');
        } catch {
            return null;
        }
    }

    isVideoFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return ['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.wmv', '.flv'].includes(ext);
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Index file location for tracking moved files
     */
    async indexFile(filename, checksum, filePath) {
        try {
            const index = await this.loadFileIndex();
            index[`${filename}:${checksum}`] = {
                path: filePath,
                indexedAt: new Date().toISOString(),
            };
            await fs.writeFile(this.fileIndexFile, JSON.stringify(index, null, 2));
        } catch (e) {
            // Silent fail
        }
    }

    async checkFileIndex(filename, checksum) {
        try {
            const index = await this.loadFileIndex();
            const key = `${filename}:${checksum}`;
            return index[key]?.path || null;
        } catch {
            return null;
        }
    }

    async loadFileIndex() {
        try {
            const data = await fs.readFile(this.fileIndexFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    /**
     * Report task completion to server (when online)
     */
    async reportToServer(taskId, status, message) {
        try {
            await this.api.reportDeletionTaskCompletion(taskId, this.deviceId, status, message);
            this.logger.info(`MediaDeletionService: Reported task ${taskId} as ${status}`);
        } catch (error) {
            // Offline - will report when back online
            this.logger.warn(`MediaDeletionService: Could not report (offline), will retry`);
        }
    }

    /**
     * Log deletion to local audit trail
     */
    async logAudit(task, status) {
        try {
            const audits = await this.loadAuditLog();
            audits.push({
                task_id: task.id,
                filename: task.filename,
                event_id: task.event_id,
                event_name: task.event_name,
                scheduled_at: task.scheduled_at,
                deleted_at: new Date().toISOString(),
                status,
                device_id: this.deviceId,
            });
            
            // Keep last 500 entries
            if (audits.length > 500) {
                audits.splice(0, audits.length - 500);
            }
            
            await fs.writeFile(this.deletionAuditFile, JSON.stringify(audits, null, 2));
        } catch (e) {
            this.logger.error('MediaDeletionService: Failed to log audit', e.message);
        }
    }

    async loadAuditLog() {
        try {
            const data = await fs.readFile(this.deletionAuditFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    async cacheTasks(tasks) {
        try {
            const existingTasks = await this.loadLocalTasks();
            const existingIds = new Set(existingTasks.map(t => t.id));
            
            // Add new tasks
            const newTasks = tasks.filter(t => !existingIds.has(t.id));
            const allTasks = [...existingTasks, ...newTasks];
            
            await this.saveLocalTasks(allTasks);
            
            if (newTasks.length > 0) {
                this.logger.info(`MediaDeletionService: Cached ${newTasks.length} new deletion tasks`);
            }
        } catch (error) {
            this.logger.error('MediaDeletionService: Error caching tasks', error);
        }
    }

    async loadLocalTasks() {
        try {
            const data = await fs.readFile(this.pendingTasksFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    async saveLocalTasks(tasks) {
        try {
            await fs.writeFile(this.pendingTasksFile, JSON.stringify(tasks, null, 2));
        } catch (error) {
            this.logger.error('MediaDeletionService: Error saving local tasks', error);
        }
    }

    /**
     * Get pending deletions count (for UI display)
     */
    async getPendingCount() {
        const tasks = await this.loadLocalTasks();
        return tasks.length;
    }

    /**
     * Get audit log (for UI/admin review)
     */
    async getAuditLog(limit = 50) {
        const audits = await this.loadAuditLog();
        return audits.slice(-limit);
    }

    // ============================================================
    // OFFLINE AUTO-DELETION: Store event metadata when files copied
    // ============================================================

    /**
     * Track a file for automatic deletion after event ends
     * Called when a file is copied from SD card during a session
     * Stores event end date locally for offline deletion
     */
    async trackFileForDeletion(fileInfo, sessionInfo) {
        try {
            const trackedFiles = await this.loadTrackedFiles();
            
            const trackRecord = {
                filename: fileInfo.name,
                filePath: fileInfo.path,
                fileSize: fileInfo.size,
                checksum: fileInfo.checksum,
                eventId: sessionInfo.eventId,
                eventName: sessionInfo.eventName,
                eventEndDate: sessionInfo.eventEndDate,
                eventEndDatetime: sessionInfo.eventEndDatetime,
                autoDeleteDays: sessionInfo.autoDeleteDays || 0,
                trackedAt: new Date().toISOString(),
                // Calculate deletion datetime
                scheduledDeletion: this.calculateDeletionTime(
                    sessionInfo.eventEndDatetime || sessionInfo.eventEndDate,
                    sessionInfo.autoDeleteDays || 0
                ),
            };

            // Use filename:checksum as unique key
            const key = `${fileInfo.name}:${fileInfo.checksum || fileInfo.size}`;
            trackedFiles[key] = trackRecord;

            await this.saveTrackedFiles(trackedFiles);
            
            this.logger.info('MediaDeletionService: File tracked for auto-deletion', {
                filename: fileInfo.name,
                scheduledDeletion: trackRecord.scheduledDeletion,
            });

            // Also store/update event metadata
            await this.storeEventMetadata(sessionInfo);

        } catch (error) {
            this.logger.error('MediaDeletionService: Failed to track file', error.message);
        }
    }

    /**
     * Store event metadata for offline reference
     */
    async storeEventMetadata(sessionInfo) {
        try {
            const events = await this.loadEventMetadata();
            
            events[sessionInfo.eventId] = {
                eventId: sessionInfo.eventId,
                eventName: sessionInfo.eventName,
                eventStartDate: sessionInfo.eventStartDate,
                eventEndDate: sessionInfo.eventEndDate,
                eventEndDatetime: sessionInfo.eventEndDatetime,
                autoDeleteDays: sessionInfo.autoDeleteDays || 0,
                updatedAt: new Date().toISOString(),
            };

            await fs.writeFile(this.eventMetadataFile, JSON.stringify(events, null, 2));
        } catch (error) {
            this.logger.error('MediaDeletionService: Failed to store event metadata', error.message);
        }
    }

    async loadEventMetadata() {
        try {
            const data = await fs.readFile(this.eventMetadataFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    async loadTrackedFiles() {
        try {
            const data = await fs.readFile(this.trackedFilesFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    async saveTrackedFiles(files) {
        await fs.writeFile(this.trackedFilesFile, JSON.stringify(files, null, 2));
    }

    /**
     * Calculate deletion time from event end + days
     */
    calculateDeletionTime(eventEndDatetime, autoDeleteDays) {
        const endDate = new Date(eventEndDatetime);
        endDate.setDate(endDate.getDate() + autoDeleteDays);
        return endDate.toISOString();
    }

    /**
     * Process tracked files for offline auto-deletion
     * Runs locally without needing server - uses stored event end dates
     * ENFORCES: Deletion only happens AFTER event has ended
     */
    async processTrackedFiles() {
        try {
            const trackedFiles = await this.loadTrackedFiles();
            const keys = Object.keys(trackedFiles);
            
            if (keys.length === 0) return;

            const now = new Date();
            let deletedCount = 0;

            for (const key of keys) {
                const record = trackedFiles[key];
                
                // ENFORCE: Event must have ended before ANY deletion
                const eventEndTime = new Date(record.eventEndDatetime || record.eventEndDate);
                if (eventEndTime > now) {
                    // Event hasn't ended yet - NEVER delete before event closure
                    continue;
                }
                
                // Now check if scheduled deletion time has passed
                const scheduledTime = new Date(record.scheduledDeletion);
                if (scheduledTime <= now) {
                    // Event has ended AND scheduled time has passed - safe to delete
                    this.logger.info(`MediaDeletionService: Auto-deleting tracked file: ${record.filename} (event ended: ${record.eventEndDatetime})`);
                    
                    const task = {
                        id: `local-${key}`,
                        filename: record.filename,
                        file_path: record.filePath,
                        file_size: record.fileSize,
                        checksum: record.checksum,
                        event_id: record.eventId,
                        event_name: record.eventName,
                        scheduled_at: record.scheduledDeletion,
                    };

                    const success = await this.executeDelete(task);
                    
                    if (success) {
                        delete trackedFiles[key];
                        deletedCount++;
                        await this.logAudit(task, 'auto_deleted_offline');
                    }
                }
            }

            if (deletedCount > 0) {
                await this.saveTrackedFiles(trackedFiles);
                this.logger.info(`MediaDeletionService: Auto-deleted ${deletedCount} files (offline mode)`);
            }
        } catch (error) {
            this.logger.error('MediaDeletionService: Error processing tracked files', error.message);
        }
    }

    /**
     * Update event end date/time if received from server
     * Allows admin to extend or shorten retention period
     */
    async updateEventMetadata(eventId, updates) {
        try {
            const events = await this.loadEventMetadata();
            
            if (events[eventId]) {
                events[eventId] = { ...events[eventId], ...updates, updatedAt: new Date().toISOString() };
                await fs.writeFile(this.eventMetadataFile, JSON.stringify(events, null, 2));

                // Update scheduled deletion for all tracked files of this event
                const trackedFiles = await this.loadTrackedFiles();
                let updated = false;

                for (const key of Object.keys(trackedFiles)) {
                    const record = trackedFiles[key];
                    if (record.eventId === eventId) {
                        record.eventEndDatetime = updates.eventEndDatetime || record.eventEndDatetime;
                        record.autoDeleteDays = updates.autoDeleteDays ?? record.autoDeleteDays;
                        record.scheduledDeletion = this.calculateDeletionTime(
                            record.eventEndDatetime,
                            record.autoDeleteDays
                        );
                        updated = true;
                    }
                }

                if (updated) {
                    await this.saveTrackedFiles(trackedFiles);
                    this.logger.info('MediaDeletionService: Updated deletion schedule for event', { eventId });
                }
            }
        } catch (error) {
            this.logger.error('MediaDeletionService: Failed to update event metadata', error.message);
        }
    }

    /**
     * Get tracked files count (for UI display)
     */
    async getTrackedFilesCount() {
        const tracked = await this.loadTrackedFiles();
        return Object.keys(tracked).length;
    }

    /**
     * Get upcoming deletions for display
     */
    async getUpcomingDeletions(limit = 10) {
        const tracked = await this.loadTrackedFiles();
        const files = Object.values(tracked)
            .sort((a, b) => new Date(a.scheduledDeletion) - new Date(b.scheduledDeletion))
            .slice(0, limit);
        return files;
    }
}

module.exports = { MediaDeletionService };
