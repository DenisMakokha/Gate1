class SessionService {
    constructor(apiService, store) {
        this.apiService = apiService;
        this.store = store;
        this.activeSessions = new Map();
    }

    async startSession(sdInfo, sdCardData) {
        const eventId = this.store.get('currentEventId');
        
        if (!eventId) {
            throw new Error('No active event selected');
        }

        const sessionData = {
            event_id: eventId,
            sd_card_id: sdCardData.id,
            camera_number: sdCardData.camera_number,
            device_id: this.store.get('deviceId'),
            files_detected: sdInfo.fileCount,
            total_size_bytes: sdInfo.totalSizeBytes,
        };

        try {
            const response = await this.apiService.startSession(sessionData);
            
            const session = {
                sessionId: response.session.session_id,
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
            };

            this.activeSessions.set(sdInfo.hardwareId, session);
            this.store.set(`sessions.${session.sessionId}`, session);

            return session;
        } catch (error) {
            console.error('Failed to start session:', error);
            throw error;
        }
    }

    async updateProgress(sessionId, updates) {
        const session = this.getSessionById(sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }

        session.filesCopied = updates.filesCopied ?? session.filesCopied;
        session.filesPending = updates.filesPending ?? session.filesPending;

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
