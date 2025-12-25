const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class MediaDeletionService {
    constructor(apiService, loggerService) {
        this.api = apiService;
        this.logger = loggerService;
        this.deviceId = null;
        this.pendingTasksFile = path.join(app.getPath('userData'), 'pending-deletions.json');
        this.checkInterval = null;
    }

    setDeviceId(deviceId) {
        this.deviceId = deviceId;
    }

    async start() {
        if (!this.deviceId) {
            this.logger.warn('MediaDeletionService: No device ID set, cannot start');
            return;
        }

        this.logger.info('MediaDeletionService: Starting deletion service');
        
        // Check immediately on start
        await this.checkAndProcessDeletions();

        // Check every 5 minutes
        this.checkInterval = setInterval(() => {
            this.checkAndProcessDeletions();
        }, 5 * 60 * 1000);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.logger.info('MediaDeletionService: Stopped');
    }

    async checkAndProcessDeletions() {
        try {
            // First, process any locally cached tasks (for offline support)
            await this.processLocalTasks();

            // Then fetch new tasks from server
            await this.fetchAndProcessServerTasks();
        } catch (error) {
            this.logger.error('MediaDeletionService: Error checking deletions', error);
        }
    }

    async fetchAndProcessServerTasks() {
        try {
            const response = await this.api.getPendingDeletionTasks(this.deviceId);
            
            if (response.tasks && response.tasks.length > 0) {
                this.logger.info(`MediaDeletionService: Found ${response.tasks.length} pending deletion tasks`);
                
                // Cache tasks locally for offline processing
                await this.cacheTasks(response.tasks);

                // Process each task
                for (const task of response.tasks) {
                    await this.processTask(task);
                }
            }
        } catch (error) {
            // If offline, tasks will be processed from local cache
            this.logger.warn('MediaDeletionService: Could not fetch server tasks (possibly offline)', error.message);
        }
    }

    async processLocalTasks() {
        try {
            const localTasks = await this.loadLocalTasks();
            
            if (localTasks.length === 0) {
                return;
            }

            this.logger.info(`MediaDeletionService: Processing ${localTasks.length} local cached tasks`);

            const remainingTasks = [];

            for (const task of localTasks) {
                const success = await this.processTask(task);
                if (!success) {
                    remainingTasks.push(task);
                }
            }

            // Save remaining tasks
            await this.saveLocalTasks(remainingTasks);
        } catch (error) {
            this.logger.error('MediaDeletionService: Error processing local tasks', error);
        }
    }

    async processTask(task) {
        this.logger.info(`MediaDeletionService: Processing deletion task ${task.id} for file: ${task.file_path}`);

        try {
            // Find the file in common locations
            const filePath = await this.findFile(task.file_path, task.filename);
            
            if (filePath) {
                // Delete the file
                await fs.unlink(filePath);
                this.logger.info(`MediaDeletionService: Deleted file: ${filePath}`);

                // Report success to server
                await this.reportCompletion(task.id, 'completed');
                return true;
            } else {
                // File not found - might already be deleted or never existed on this device
                this.logger.info(`MediaDeletionService: File not found, marking as completed: ${task.file_path}`);
                await this.reportCompletion(task.id, 'completed');
                return true;
            }
        } catch (error) {
            this.logger.error(`MediaDeletionService: Failed to delete file for task ${task.id}`, error);
            await this.reportCompletion(task.id, 'failed', error.message);
            return false;
        }
    }

    async findFile(originalPath, filename) {
        // Common locations where media files might be stored
        const searchLocations = [
            originalPath,
            path.join(app.getPath('documents'), 'Gate1', filename || path.basename(originalPath)),
            path.join(app.getPath('videos'), 'Gate1', filename || path.basename(originalPath)),
            path.join(app.getPath('downloads'), filename || path.basename(originalPath)),
        ];

        // Also search in user's home directory common folders
        const homeDir = app.getPath('home');
        const additionalPaths = [
            path.join(homeDir, 'Videos', filename || path.basename(originalPath)),
            path.join(homeDir, 'Documents', filename || path.basename(originalPath)),
            path.join(homeDir, 'Desktop', filename || path.basename(originalPath)),
        ];

        const allPaths = [...searchLocations, ...additionalPaths];

        for (const searchPath of allPaths) {
            try {
                await fs.access(searchPath);
                return searchPath;
            } catch {
                // File not found at this location, continue searching
            }
        }

        return null;
    }

    async reportCompletion(taskId, status, errorMessage = null) {
        try {
            await this.api.reportDeletionTaskCompletion(taskId, this.deviceId, status, errorMessage);
            this.logger.info(`MediaDeletionService: Reported task ${taskId} as ${status}`);
        } catch (error) {
            // If offline, the task will be retried later
            this.logger.warn(`MediaDeletionService: Could not report completion for task ${taskId} (possibly offline)`);
        }
    }

    async cacheTasks(tasks) {
        try {
            const existingTasks = await this.loadLocalTasks();
            const existingIds = new Set(existingTasks.map(t => t.id));
            
            // Add new tasks that aren't already cached
            const newTasks = tasks.filter(t => !existingIds.has(t.id));
            const allTasks = [...existingTasks, ...newTasks];
            
            await this.saveLocalTasks(allTasks);
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
}

module.exports = { MediaDeletionService };
