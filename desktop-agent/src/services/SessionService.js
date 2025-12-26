const { EventEmitter } = require('events');

class SessionService extends EventEmitter {
    constructor(apiService, store) {
        super();
        this.apiService = apiService;
        this.store = store;
        this.activeSessions = new Map();
        
        // Restore active sessions from store on startup
        this.restoreSessions();
    }

    restoreSessions() {
        try {
            const allSessions = this.store.get('sessions', {});
            for (const [sessionId, session] of Object.entries(allSessions)) {
                if (session.status === 'active') {
                    this.activeSessions.set(session.sdHardwareId, session);
                    console.log(`Restored active session: ${sessionId}`);
                }
            }
        } catch (error) {
            console.error('Failed to restore sessions:', error);
        }
    }

    async startSession(sdInfo, sdCardData) {
        const eventId = this.store.get('currentEventId');
        const deviceId = this.store.get('deviceId');

        // Create local session first (works even without API)
        const localSessionId = `LOCAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const session = {
            sessionId: localSessionId,
            sdHardwareId: sdInfo.hardwareId,
            sdMountPath: sdInfo.mountPath,
            cameraNumber: sdCardData.camera_number,
            sdLabel: sdCardData.sd_label,
            filesDetected: sdInfo.fileCount,
            filesCopied: 0,
            filesPending: sdInfo.fileCount,
            totalSizeBytes: sdInfo.totalSizeBytes,
            startedAt: new Date().toISOString(),
            status: 'active',
            synced: false,
        };

        // Store locally first
        this.activeSessions.set(sdInfo.hardwareId, session);
        this.store.set(`sessions.${session.sessionId}`, session);
        
        // Emit session started event for UI banner
        this.emit('session-started', session);

        // Try to sync with server if we have event and device
        if (eventId && deviceId) {
            try {
                const sessionData = {
                    event_id: eventId,
                    sd_card_id: sdCardData.id,
                    camera_number: sdCardData.camera_number,
                    device_id: deviceId,
                    files_detected: sdInfo.fileCount,
                    total_size_bytes: sdInfo.totalSizeBytes,
                };

                const response = await this.apiService.startSession(sessionData);
                
                // Update with server session ID
                session.sessionId = response.session?.session_id || session.sessionId;
                session.synced = true;
                
                this.store.set(`sessions.${session.sessionId}`, session);
            } catch (error) {
                console.warn('Failed to sync session to server, continuing locally:', error.message);
                // Continue with local session - will sync later
            }
        } else {
            console.log('No event selected, session stored locally only');
        }

        return session;
    }

    async updateProgress(sessionId, updates) {
        const session = this.getSessionById(sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }

        session.filesCopied = updates.filesCopied ?? session.filesCopied;
        session.filesPending = updates.filesPending ?? session.filesPending;
        
        // Emit progress update for UI banner
        this.emit('session-progress', session);

        try {
            await this.apiService.updateSessionProgress(sessionId, {
                files_copied: session.filesCopied,
                files_pending: session.filesPending,
            });

            this.store.set(`sessions.${sessionId}`, session);
            return session;
        } catch (error) {
            console.error('Failed to update session progress:', error);
            // Continue locally even if API fails
            return session;
        }
    }

    async endSession(sdHardwareIdOrSessionId, removalDecision) {
        let session = this.activeSessions.get(sdHardwareIdOrSessionId);
        
        if (!session) {
            session = this.getSessionById(sdHardwareIdOrSessionId);
        }

        if (!session) {
            throw new Error('Session not found');
        }

        try {
            await this.apiService.endSession(session.sessionId, {
                removal_decision: removalDecision,
                files_copied: session.filesCopied,
                files_pending: session.filesPending,
            });

            session.status = removalDecision === 'safe' ? 'completed' : 'early_removed';
            session.endedAt = new Date().toISOString();
            session.removalDecision = removalDecision;

            this.activeSessions.delete(session.sdHardwareId);
            this.store.set(`sessions.${session.sessionId}`, session);
            
            // Emit session ended event for UI banner
            this.emit('session-ended', session);

            return session;
        } catch (error) {
            console.error('Failed to end session:', error);
            throw error;
        }
    }

    getActiveSession(sdHardwareId) {
        return this.activeSessions.get(sdHardwareId);
    }

    getSessionById(sessionId) {
        for (const session of this.activeSessions.values()) {
            if (session.sessionId === sessionId) {
                return session;
            }
        }
        return this.store.get(`sessions.${sessionId}`);
    }

    getActiveSessionByPath(mountPath) {
        for (const session of this.activeSessions.values()) {
            if (session.sdMountPath === mountPath || 
                mountPath.startsWith(session.sdMountPath)) {
                return session;
            }
        }
        return null;
    }

    getAllActiveSessions() {
        return Array.from(this.activeSessions.values());
    }

    getCopyProgress(sessionId) {
        const session = this.getSessionById(sessionId);
        if (!session || session.filesDetected === 0) {
            return 100;
        }
        return Math.round((session.filesCopied / session.filesDetected) * 100);
    }

    canSafelyRemove(sdHardwareId) {
        const session = this.getActiveSession(sdHardwareId);
        if (!session) {
            return { safe: true, reason: 'No active session' };
        }

        if (session.filesPending === 0) {
            return { safe: true, reason: 'All files copied' };
        }

        return {
            safe: false,
            reason: `${session.filesPending} files not yet copied`,
            session,
        };
    }
}

module.exports = { SessionService };
