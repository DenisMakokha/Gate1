<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Log;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class EmailService
{
    protected ?PHPMailer $mailer = null;
    protected array $config = [];

    public function __construct()
    {
        $this->loadConfig();
    }

    protected function loadConfig(): void
    {
        $this->config = SystemSetting::getGroup('smtp');
    }

    protected function getMailer(): PHPMailer
    {
        if ($this->mailer) {
            return $this->mailer;
        }

        $this->mailer = new PHPMailer(true);

        try {
            $this->mailer->isSMTP();
            $this->mailer->Host = $this->config['smtp_host'] ?? '';
            $this->mailer->Port = $this->config['smtp_port'] ?? 587;
            $this->mailer->Username = $this->config['smtp_username'] ?? '';
            $this->mailer->Password = $this->config['smtp_password'] ?? '';
            
            if (!empty($this->mailer->Username)) {
                $this->mailer->SMTPAuth = true;
            }

            $encryption = $this->config['smtp_encryption'] ?? 'tls';
            if ($encryption !== 'none') {
                $this->mailer->SMTPSecure = $encryption === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
            }

            $this->mailer->setFrom(
                $this->config['smtp_from_address'] ?? 'noreply@gate1system.org',
                $this->config['smtp_from_name'] ?? 'Gate 1 System'
            );

            $this->mailer->isHTML(true);
            $this->mailer->CharSet = 'UTF-8';

        } catch (Exception $e) {
            Log::error('Email configuration error: ' . $e->getMessage());
        }

        return $this->mailer;
    }

    public function send(string $to, string $subject, string $htmlBody, string $textBody = ''): bool
    {
        if (empty($this->config['smtp_host'])) {
            Log::warning('SMTP not configured, email not sent to: ' . $to);
            return false;
        }

        try {
            $mailer = $this->getMailer();
            $mailer->clearAddresses();
            $mailer->addAddress($to);
            $mailer->Subject = $subject;
            $mailer->Body = $htmlBody;
            $mailer->AltBody = $textBody ?: strip_tags($htmlBody);

            $result = $mailer->send();
            Log::info("Email sent to {$to}: {$subject}");
            return $result;

        } catch (Exception $e) {
            Log::error('Email send error: ' . $e->getMessage());
            return false;
        }
    }

    public function sendPasswordReset(string $email, string $name, string $resetUrl): bool
    {
        $subject = 'Reset Your Password - Gate 1 System';
        
        $html = $this->getEmailTemplate('password_reset', [
            'name' => $name,
            'reset_url' => $resetUrl,
            'expires' => '1 hour',
        ]);

        return $this->send($email, $subject, $html);
    }

    public function sendRegistrationPending(string $email, string $name): bool
    {
        $subject = 'Registration Received - Gate 1 System';
        
        $html = $this->getEmailTemplate('registration_pending', [
            'name' => $name,
        ]);

        return $this->send($email, $subject, $html);
    }

    public function sendRegistrationApproved(string $email, string $name, string $groupName = null): bool
    {
        $subject = 'Your Account Has Been Approved - Gate 1 System';
        
        $html = $this->getEmailTemplate('registration_approved', [
            'name' => $name,
            'group_name' => $groupName,
            'login_url' => SystemSetting::get('app_url', 'http://localhost:3000') . '/login',
        ]);

        return $this->send($email, $subject, $html);
    }

    public function sendRegistrationRejected(string $email, string $name, string $reason = null): bool
    {
        $subject = 'Registration Update - Gate 1 System';
        
        $html = $this->getEmailTemplate('registration_rejected', [
            'name' => $name,
            'reason' => $reason,
        ]);

        return $this->send($email, $subject, $html);
    }

    public function sendInvitation(string $email, string $inviterName, string $inviteUrl): bool
    {
        $subject = "You've Been Invited to Join Gate 1 System";
        
        $html = $this->getEmailTemplate('invitation', [
            'inviter_name' => $inviterName,
            'invite_url' => $inviteUrl,
            'expires' => '7 days',
        ]);

        return $this->send($email, $subject, $html);
    }

    public function testConnection(): array
    {
        if (empty($this->config['smtp_host'])) {
            return ['success' => false, 'message' => 'SMTP host not configured'];
        }

        try {
            $mailer = $this->getMailer();
            $mailer->SMTPDebug = 0;
            
            if ($mailer->smtpConnect()) {
                $mailer->smtpClose();
                return ['success' => true, 'message' => 'SMTP connection successful'];
            }
            
            return ['success' => false, 'message' => 'Failed to connect to SMTP server'];

        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    protected function getEmailTemplate(string $template, array $data): string
    {
        $appName = SystemSetting::get('app_name', 'Gate 1 System');
        $appUrl = SystemSetting::get('app_url', 'http://localhost:3000');
        
        $baseStyle = '
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 40px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo-box { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; font-weight: bold; font-size: 24px; padding: 12px 20px; border-radius: 12px; }
            h1 { color: #1a1a1a; font-size: 24px; margin: 0 0 20px; }
            p { margin: 0 0 16px; color: #4a4a4a; }
            .button { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .button:hover { opacity: 0.9; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 13px; }
            .highlight { background: #f0f9ff; border-left: 4px solid #6366f1; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0; }
        ';

        $templates = [
            'password_reset' => "
                <h1>Reset Your Password</h1>
                <p>Hi {$data['name']},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <p style='text-align: center;'>
                    <a href='{$data['reset_url']}' class='button'>Reset Password</a>
                </p>
                <p class='highlight'>This link will expire in {$data['expires']}. If you didn't request this, you can safely ignore this email.</p>
            ",
            
            'registration_pending' => "
                <h1>Registration Received</h1>
                <p>Hi {$data['name']},</p>
                <p>Thank you for registering with Gate 1 System. Your application has been received and is pending approval.</p>
                <p class='highlight'>An administrator will review your application shortly. You'll receive an email once your account has been approved.</p>
                <p>If you have any questions, please contact your supervisor or the system administrator.</p>
            ",
            
            'registration_approved' => "
                <h1>Welcome to Gate 1 System!</h1>
                <p>Hi {$data['name']},</p>
                <p>Great news! Your account has been approved and you can now access the system.</p>
                " . ($data['group_name'] ? "<p class='highlight'>You have been assigned to: <strong>{$data['group_name']}</strong></p>" : "") . "
                <p style='text-align: center;'>
                    <a href='{$data['login_url']}' class='button'>Login Now</a>
                </p>
                <p>If you have any questions, please contact your group leader or the system administrator.</p>
            ",
            
            'registration_rejected' => "
                <h1>Registration Update</h1>
                <p>Hi {$data['name']},</p>
                <p>We regret to inform you that your registration request could not be approved at this time.</p>
                " . ($data['reason'] ? "<p class='highlight'><strong>Reason:</strong> {$data['reason']}</p>" : "") . "
                <p>If you believe this was a mistake or have questions, please contact the system administrator.</p>
            ",
            
            'invitation' => "
                <h1>You're Invited!</h1>
                <p>{$data['inviter_name']} has invited you to join Gate 1 System.</p>
                <p>Click the button below to complete your registration:</p>
                <p style='text-align: center;'>
                    <a href='{$data['invite_url']}' class='button'>Accept Invitation</a>
                </p>
                <p class='highlight'>This invitation will expire in {$data['expires']}.</p>
            ",
        ];

        $content = $templates[$template] ?? '<p>Email content not found.</p>';

        return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>{$baseStyle}</style>
            </head>
            <body>
                <div class='container'>
                    <div class='card'>
                        <div class='logo'>
                            <span class='logo-box'>G1</span>
                        </div>
                        {$content}
                        <div class='footer'>
                            <p>&copy; " . date('Y') . " {$appName}. All rights reserved.</p>
                            <p><a href='{$appUrl}' style='color: #6366f1;'>{$appUrl}</a></p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        ";
    }
}
