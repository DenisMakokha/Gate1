import React, { useState, useEffect } from 'react';
import { settingsService } from '../services/api';
import {
  Settings as SettingsIcon,
  Mail,
  Server,
  Shield,
  Globe,
  Save,
  TestTube,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [generalSettings, setGeneralSettings] = useState({
    app_name: '',
    app_url: '',
    require_approval: true,
    allow_self_registration: true,
  });

  const [smtpSettings, setSmtpSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_encryption: 'tls',
    smtp_from_address: '',
    smtp_from_name: '',
  });

  const [testEmail, setTestEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [generalRes, smtpRes] = await Promise.all([
        settingsService.getGeneral(),
        settingsService.getSmtp(),
      ]);
      setGeneralSettings(generalRes);
      setSmtpSettings(smtpRes);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const saveGeneralSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await settingsService.updateGeneral(generalSettings);
      setMessage({ type: 'success', text: 'General settings saved successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const saveSmtpSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await settingsService.updateSmtp(smtpSettings);
      setMessage({ type: 'success', text: 'SMTP settings saved successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const testSmtpConnection = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Please enter a test email address' });
      return;
    }
    setTesting(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await settingsService.testSmtp(testEmail);
      setMessage({ type: 'success', text: response.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'SMTP test failed' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'smtp', label: 'Email (SMTP)', icon: Mail },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500">Configure your Gate 1 System</p>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-100">
          <nav className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application Name
                  </label>
                  <input
                    type="text"
                    value={generalSettings.app_name}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, app_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application URL
                  </label>
                  <input
                    type="url"
                    value={generalSettings.app_url}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, app_url: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://gate1.cloud"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={generalSettings.allow_self_registration}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, allow_self_registration: e.target.checked })}
                      className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Allow Self-Registration</div>
                      <div className="text-sm text-gray-500">
                        Allow users to register themselves without an invitation
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={generalSettings.require_approval}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, require_approval: e.target.checked })}
                      className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Require Approval</div>
                      <div className="text-sm text-gray-500">
                        New registrations must be approved by an admin or group leader
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={saveGeneralSettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* SMTP Settings */}
          {activeTab === 'smtp' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Email Configuration</h4>
                    <p className="text-sm text-blue-700">
                      Configure SMTP settings to enable email notifications for password resets, registration approvals, and alerts.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Host
                  </label>
                  <div className="relative">
                    <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={smtpSettings.smtp_host}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_host: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={smtpSettings.smtp_port}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_port: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="587"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={smtpSettings.smtp_username}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_username: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={smtpSettings.smtp_password}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_password: e.target.value })}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Encryption
                  </label>
                  <select
                    value={smtpSettings.smtp_encryption}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_encryption: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Address
                  </label>
                  <input
                    type="email"
                    value={smtpSettings.smtp_from_address}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_from_address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="noreply@gate1system.org"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={smtpSettings.smtp_from_name}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_from_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Gate 1 System"
                  />
                </div>
              </div>

              {/* Test Email */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Configuration</h3>
                <div className="flex gap-4">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email to send test message"
                  />
                  <button
                    onClick={testSmtpConnection}
                    disabled={testing}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 font-medium transition-colors"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                    Send Test
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={saveSmtpSettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save SMTP Settings
                </button>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900">Security Settings</h4>
                    <p className="text-sm text-amber-700">
                      Additional security settings will be available in a future update.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center py-12 text-gray-500">
                <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Security settings coming soon</p>
                <p className="text-sm">Session management, 2FA, and more</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
