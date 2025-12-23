<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PushNotificationService
{
    protected ?string $serverKey = null;
    protected string $fcmUrl = 'https://fcm.googleapis.com/fcm/send';

    public function __construct()
    {
        $this->serverKey = SystemSetting::get('firebase_server_key');
    }

    public function sendToUser(User $user, string $title, string $body, array $data = []): bool
    {
        if (!$user->fcm_token) {
            Log::info("No FCM token for user {$user->id}");
            return false;
        }

        return $this->send($user->fcm_token, $title, $body, $data);
    }

    public function sendToUsers(array $users, string $title, string $body, array $data = []): int
    {
        $sent = 0;
        foreach ($users as $user) {
            if ($this->sendToUser($user, $title, $body, $data)) {
                $sent++;
            }
        }
        return $sent;
    }

    public function sendToTopic(string $topic, string $title, string $body, array $data = []): bool
    {
        return $this->send("/topics/{$topic}", $title, $body, $data);
    }

    public function send(string $to, string $title, string $body, array $data = []): bool
    {
        if (!$this->serverKey) {
            Log::warning('Firebase server key not configured');
            return false;
        }

        try {
            $payload = [
                'to' => $to,
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                    'sound' => 'default',
                    'badge' => 1,
                ],
                'data' => array_merge($data, [
                    'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                ]),
                'priority' => 'high',
            ];

            $response = Http::withHeaders([
                'Authorization' => 'key=' . $this->serverKey,
                'Content-Type' => 'application/json',
            ])->post($this->fcmUrl, $payload);

            if ($response->successful()) {
                Log::info("Push notification sent: {$title}");
                return true;
            }

            Log::error('FCM error: ' . $response->body());
            return false;

        } catch (\Exception $e) {
            Log::error('Push notification error: ' . $e->getMessage());
            return false;
        }
    }

    public function notifyNewIssue($issue): void
    {
        // Notify group leader
        if ($issue->group && $issue->group->leader) {
            $this->sendToUser(
                $issue->group->leader,
                'New Issue Reported',
                "A {$issue->severity} issue has been reported in your group",
                [
                    'type' => 'new_issue',
                    'issue_id' => $issue->issue_id,
                    'severity' => $issue->severity,
                ]
            );
        }

        // Notify QA team for critical issues
        if ($issue->severity === 'critical') {
            $qaUsers = User::whereHas('roles', fn($q) => $q->where('slug', 'qa'))->get();
            $this->sendToUsers(
                $qaUsers->all(),
                '🚨 Critical Issue',
                "A critical issue requires immediate attention",
                [
                    'type' => 'critical_issue',
                    'issue_id' => $issue->issue_id,
                ]
            );
        }
    }

    public function notifyIssueResolved($issue): void
    {
        if ($issue->reporter) {
            $this->sendToUser(
                $issue->reporter,
                'Issue Resolved',
                "Your reported issue has been resolved",
                [
                    'type' => 'issue_resolved',
                    'issue_id' => $issue->issue_id,
                ]
            );
        }
    }

    public function notifyRegistrationApproved(User $user): void
    {
        $this->sendToUser(
            $user,
            'Account Approved! 🎉',
            'Your registration has been approved. You can now access the system.',
            [
                'type' => 'registration_approved',
            ]
        );
    }

    public function notifyNewRegistration(): void
    {
        $admins = User::whereHas('roles', fn($q) => $q->where('slug', 'admin'))->get();
        $this->sendToUsers(
            $admins->all(),
            'New Registration',
            'A new user has registered and is pending approval',
            [
                'type' => 'new_registration',
            ]
        );
    }

    /**
     * Alert: SD card removed early (incomplete copy)
     */
    public function notifyIncompleteCopy($session, User $editor): void
    {
        // Notify the editor
        $this->sendToUser(
            $editor,
            '⚠️ Incomplete Copy',
            "SD card removed before copy completed. {$session->files_pending} files remaining.",
            [
                'type' => 'incomplete_copy',
                'session_id' => $session->session_id,
                'files_pending' => $session->files_pending,
            ]
        );

        // Notify group leaders
        $groupLeaders = $this->getGroupLeadersForEditor($editor);
        $this->sendToUsers(
            $groupLeaders,
            '⚠️ Incomplete Copy Alert',
            "{$editor->name} removed SD card with {$session->files_pending} files pending",
            [
                'type' => 'incomplete_copy',
                'session_id' => $session->session_id,
                'editor_id' => $editor->id,
                'editor_name' => $editor->name,
            ]
        );
    }

    /**
     * Alert: Backup disk running low on space
     */
    public function notifyLowDiskSpace($disk, int $percentUsed): void
    {
        $backupTeam = User::whereHas('roles', fn($q) => $q->where('slug', 'backup'))->get();
        $admins = User::whereHas('roles', fn($q) => $q->where('slug', 'admin'))->get();

        $recipients = $backupTeam->merge($admins)->unique('id');

        $this->sendToUsers(
            $recipients->all(),
            '🔴 Low Disk Space',
            "Backup disk {$disk->disk_label} is {$percentUsed}% full. Only " . $this->formatBytes($disk->free_space_bytes) . " remaining.",
            [
                'type' => 'low_disk_space',
                'disk_id' => $disk->id,
                'disk_label' => $disk->disk_label,
                'percent_used' => $percentUsed,
            ]
        );
    }

    /**
     * Alert: Editor offline for extended period during active event
     */
    public function notifyEditorOffline(User $editor, int $minutesOffline): void
    {
        $groupLeaders = $this->getGroupLeadersForEditor($editor);

        $this->sendToUsers(
            $groupLeaders,
            '📴 Editor Offline',
            "{$editor->name} has been offline for {$minutesOffline} minutes during active event",
            [
                'type' => 'editor_offline',
                'editor_id' => $editor->id,
                'editor_name' => $editor->name,
                'minutes_offline' => $minutesOffline,
            ]
        );
    }

    /**
     * Alert: Backup verification completed
     */
    public function notifyBackupVerified($backup, User $verifier): void
    {
        // Notify the original editor
        if ($backup->media && $backup->media->editor) {
            $this->sendToUser(
                $backup->media->editor,
                '✅ Backup Verified',
                "Your media has been backed up and verified on {$backup->disk->disk_label}",
                [
                    'type' => 'backup_verified',
                    'media_id' => $backup->media_id,
                ]
            );
        }
    }

    /**
     * Alert: Copy session completed
     */
    public function notifyCopyCompleted($session, User $editor): void
    {
        $this->sendToUser(
            $editor,
            '✅ Copy Complete',
            "Successfully copied {$session->files_copied} files from Camera {$session->camera_number}",
            [
                'type' => 'copy_completed',
                'session_id' => $session->session_id,
                'files_copied' => $session->files_copied,
            ]
        );

        // Notify group leaders
        $groupLeaders = $this->getGroupLeadersForEditor($editor);
        $this->sendToUsers(
            $groupLeaders,
            '✅ Copy Complete',
            "{$editor->name} completed copying {$session->files_copied} files",
            [
                'type' => 'copy_completed',
                'session_id' => $session->session_id,
                'editor_name' => $editor->name,
            ]
        );
    }

    /**
     * Alert: Shift starting soon
     */
    public function notifyShiftReminder(User $editor, $shift): void
    {
        $this->sendToUser(
            $editor,
            '⏰ Shift Starting Soon',
            "Your shift starts in 15 minutes at {$shift->start_time->format('H:i')}",
            [
                'type' => 'shift_reminder',
                'shift_id' => $shift->id,
            ]
        );
    }

    /**
     * Alert: Daily summary ready
     */
    public function notifyDailySummary(User $user, array $stats): void
    {
        $this->sendToUser(
            $user,
            '📊 Daily Summary',
            "Today: {$stats['files_copied']} files copied, {$stats['files_backed_up']} backed up",
            [
                'type' => 'daily_summary',
                'stats' => $stats,
            ]
        );
    }

    /**
     * Get group leaders for an editor
     */
    protected function getGroupLeadersForEditor(User $editor): array
    {
        return User::whereHas('ledGroups', function ($q) use ($editor) {
            $q->whereHas('members', fn($m) => $m->where('users.id', $editor->id));
        })->get()->all();
    }

    /**
     * Format bytes to human readable
     */
    protected function formatBytes($bytes): string
    {
        if ($bytes == 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        return round($bytes, 2) . ' ' . $units[$i];
    }
}
