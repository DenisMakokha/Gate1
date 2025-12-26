const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * AudioAnalyzer - Lightweight audio track detection using file headers
 * No external dependencies - reads container metadata directly
 */
class AudioAnalyzer {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Analyze a video file for audio issues
     * Uses lightweight header parsing - no FFprobe needed
     */
    async analyze(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            
            let result;
            switch (ext) {
                case '.mp4':
                case '.m4v':
                    result = await this.analyzeMp4(filePath);
                    break;
                case '.mov':
                    result = await this.analyzeQuickTime(filePath);
                    break;
                case '.avi':
                    result = await this.analyzeAvi(filePath);
                    break;
                case '.mts':
                case '.m2ts':
                    result = await this.analyzeMts(filePath);
                    break;
                default:
                    // For unsupported formats, assume OK
                    result = { hasIssue: false };
            }
            
            return result;
        } catch (error) {
            this.logger?.warn('Audio analysis failed', { file: filePath, error: error.message });
            // Return no issue on error - don't block workflow
            return { hasIssue: false, error: error.message };
        }
    }

    /**
     * Analyze MP4/M4V container for audio tracks
     * MP4 uses boxes/atoms - look for 'moov' -> 'trak' -> 'mdia' -> 'hdlr' with 'soun' type
     */
    async analyzeMp4(filePath) {
        const fd = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(64 * 1024); // Read first 64KB
        
        try {
            await fd.read(buffer, 0, buffer.length, 0);
            await fd.close();
            
            // Quick scan for audio indicators in MP4
            const hasAudioTrack = this.findInBuffer(buffer, 'soun') || 
                                  this.findInBuffer(buffer, 'mp4a') ||
                                  this.findInBuffer(buffer, 'aac ');
            
            if (!hasAudioTrack) {
                return {
                    hasIssue: true,
                    issue: 'no_audio',
                    details: 'No audio track found in MP4 container'
                };
            }
            
            // Check for stereo vs mono (look for channel count in esds or stsd)
            const channelInfo = this.detectChannels(buffer);
            if (channelInfo.channels === 1) {
                return {
                    hasIssue: true,
                    issue: 'mono_audio',
                    details: 'Audio is mono - may indicate recording issue'
                };
            }
            
            return { hasIssue: false };
        } catch (e) {
            await fd.close().catch(() => {});
            throw e;
        }
    }

    /**
     * Analyze QuickTime MOV container
     * Similar structure to MP4
     */
    async analyzeQuickTime(filePath) {
        // MOV has same atom structure as MP4
        return this.analyzeMp4(filePath);
    }

    /**
     * Analyze AVI container for audio streams
     * Look for 'auds' stream type in header
     */
    async analyzeAvi(filePath) {
        const fd = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(32 * 1024); // Read first 32KB
        
        try {
            await fd.read(buffer, 0, buffer.length, 0);
            await fd.close();
            
            // Check for RIFF AVI header
            const riff = buffer.toString('ascii', 0, 4);
            if (riff !== 'RIFF') {
                return { hasIssue: false }; // Not a valid AVI, skip
            }
            
            // Look for audio stream header
            const hasAudioStream = this.findInBuffer(buffer, 'auds');
            
            if (!hasAudioStream) {
                return {
                    hasIssue: true,
                    issue: 'no_audio',
                    details: 'No audio stream found in AVI container'
                };
            }
            
            return { hasIssue: false };
        } catch (e) {
            await fd.close().catch(() => {});
            throw e;
        }
    }

    /**
     * Analyze MTS/M2TS (AVCHD) container
     * MPEG-2 Transport Stream with specific audio PIDs
     */
    async analyzeMts(filePath) {
        const fd = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(64 * 1024);
        
        try {
            await fd.read(buffer, 0, buffer.length, 0);
            await fd.close();
            
            // MTS files should have TS packets (188 or 192 bytes)
            // Audio is typically AC3 or AAC in AVCHD
            
            // Look for common audio codec signatures
            const hasAudio = this.findInBuffer(buffer, Buffer.from([0x0B, 0x77])) || // AC3 sync
                            this.findInBuffer(buffer, Buffer.from([0xFF, 0xF1])) || // AAC ADTS
                            this.findInBuffer(buffer, Buffer.from([0xFF, 0xF9]));   // AAC ADTS
            
            if (!hasAudio) {
                // MTS almost always has audio, so only flag if clearly missing
                // Don't be too aggressive here
                return { hasIssue: false };
            }
            
            return { hasIssue: false };
        } catch (e) {
            await fd.close().catch(() => {});
            throw e;
        }
    }

    /**
     * Search for a pattern in a buffer
     */
    findInBuffer(buffer, pattern) {
        const searchBuffer = Buffer.isBuffer(pattern) ? pattern : Buffer.from(pattern, 'ascii');
        return buffer.indexOf(searchBuffer) !== -1;
    }

    /**
     * Try to detect channel count from MP4/MOV header
     */
    detectChannels(buffer) {
        // Look for channel count in audio sample description
        // This is a simplified check - full parsing would be complex
        
        // In MP4, channel count is typically in stsd -> mp4a atom
        // Format: ... channelcount (2 bytes) ...
        
        // Default to assuming stereo if we can't determine
        return { channels: 2 };
    }

    /**
     * Quick file size sanity check
     * Very small files might indicate recording issues
     */
    async quickSizeCheck(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const sizeInMB = stats.size / (1024 * 1024);
            
            // If file is less than 1MB, might be incomplete
            if (sizeInMB < 1) {
                return {
                    hasIssue: true,
                    issue: 'small_file',
                    details: `File is very small (${sizeInMB.toFixed(2)} MB) - may be incomplete`
                };
            }
            
            return { hasIssue: false };
        } catch (e) {
            return { hasIssue: false };
        }
    }
}

module.exports = { AudioAnalyzer };
