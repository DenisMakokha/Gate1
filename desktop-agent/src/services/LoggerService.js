const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class LoggerService {
    constructor() {
        this.logDir = path.join(app.getPath('userData'), 'logs');
        this.currentLogFile = null;
        this.maxLogFiles = 7; // Keep 7 days of logs
        this.maxLogSize = 10 * 1024 * 1024; // 10MB per file
        this.writeQueue = []; // Buffer for async writes
        this.isWriting = false;
        
        this.ensureLogDirectory();
        this.rotateLogFile();
        this.cleanOldLogs();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getLogFileName() {
        const date = new Date().toISOString().split('T')[0];
        return `gate1-agent-${date}.log`;
    }

    rotateLogFile() {
        const fileName = this.getLogFileName();
        this.currentLogFile = path.join(this.logDir, fileName);
    }

    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(f => f.startsWith('gate1-agent-') && f.endsWith('.log'))
                .map(f => ({
                    name: f,
                    path: path.join(this.logDir, f),
                    time: fs.statSync(path.join(this.logDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);

            // Remove files beyond maxLogFiles
            files.slice(this.maxLogFiles).forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                    console.log(`Deleted old log file: ${file.name}`);
                } catch (e) {
                    console.error(`Failed to delete log file: ${file.name}`, e);
                }
            });
        } catch (e) {
            console.error('Failed to clean old logs:', e);
        }
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        let logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (data) {
            if (typeof data === 'object') {
                logLine += ` ${JSON.stringify(data)}`;
            } else {
                logLine += ` ${data}`;
            }
        }
        
        return logLine;
    }

    write(level, message, data = null) {
        // Check if we need to rotate (new day)
        const expectedFile = path.join(this.logDir, this.getLogFileName());
        if (this.currentLogFile !== expectedFile) {
            this.rotateLogFile();
        }

        const logLine = this.formatMessage(level, message, data);
        
        // Console output (sync is fine for console)
        switch (level) {
            case 'error':
                console.error(logLine);
                break;
            case 'warn':
                console.warn(logLine);
                break;
            default:
                console.log(logLine);
        }

        // Queue for async file output
        this.writeQueue.push(logLine);
        this.processWriteQueue();
    }

    async processWriteQueue() {
        if (this.isWriting || this.writeQueue.length === 0) return;
        
        this.isWriting = true;
        
        try {
            // Batch write all queued lines
            const lines = this.writeQueue.splice(0, this.writeQueue.length);
            await fsPromises.appendFile(this.currentLogFile, lines.join('\n') + '\n');
            
            // Check file size and rotate if needed
            const stats = await fsPromises.stat(this.currentLogFile);
            if (stats.size > this.maxLogSize) {
                const newName = this.currentLogFile.replace('.log', `-${Date.now()}.log`);
                await fsPromises.rename(this.currentLogFile, newName);
            }
        } catch (e) {
            console.error('Failed to write to log file:', e);
        } finally {
            this.isWriting = false;
            
            // Process any new items that came in while writing
            if (this.writeQueue.length > 0) {
                this.processWriteQueue();
            }
        }
    }

    info(message, data = null) {
        this.write('info', message, data);
    }

    warn(message, data = null) {
        this.write('warn', message, data);
    }

    error(message, data = null) {
        this.write('error', message, data);
    }

    debug(message, data = null) {
        this.write('debug', message, data);
    }

    getLogPath() {
        return this.logDir;
    }

    getCurrentLogFile() {
        return this.currentLogFile;
    }

    async getRecentLogs(lines = 100) {
        try {
            const content = fs.readFileSync(this.currentLogFile, 'utf8');
            const allLines = content.split('\n').filter(l => l.trim());
            return allLines.slice(-lines);
        } catch (e) {
            return [];
        }
    }
}

module.exports = { LoggerService };
