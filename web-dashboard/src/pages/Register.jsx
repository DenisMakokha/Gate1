import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { registrationService } from '../services/api';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invitationToken = searchParams.get('token');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
    registration_notes: '',
  });

  const [invitation, setInvitation] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [checkingInvitation, setCheckingInvitation] = useState(!!invitationToken);

  useEffect(() => {
    if (invitationToken) {
      checkInvitation();
    }
  }, [invitationToken]);

  const checkInvitation = async () => {
    try {
      const response = await registrationService.checkInvitation(invitationToken);
      setInvitation(response.data);
      setFormData(prev => ({ ...prev, email: response.data.email }));
    } catch (err) {
      setError('Invalid or expired invitation link');
    } finally {
      setCheckingInvitation(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.password_confirmation) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      if (invitationToken) {
        await registrationService.registerWithInvitation({
          token: invitationToken,
          ...formData,
        });
      } else {
        await registrationService.register(formData);
      }
      setSuccess(true);
    } catch (err) {
      setError(err.message || err.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (checkingInvitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 text-center border border-white/20">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              {invitationToken ? 'Registration Complete!' : 'Application Submitted!'}
            </h2>
            <p className="text-gray-300 mb-6">
              {invitationToken
                ? 'Your account is ready. You can now login to the system.'
                : 'Your registration is pending approval. You will receive an email once your account has been approved.'}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
              <span className="text-3xl font-bold text-white">G1</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {invitationToken ? 'Complete Your Registration' : 'Join Gate 1 System'}
            </h1>
            <p className="text-gray-400 mt-2">
              {invitationToken
                ? 'You have been invited to join the team'
                : 'Create your editor account'}
            </p>
            {invitation?.groups?.length > 0 && (
              <div className="mt-3 px-4 py-2 bg-purple-500/20 rounded-lg inline-block">
                <span className="text-purple-300 text-sm">
                  Joining: {invitation.groups.map(g => g.name).join(', ')}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-50"
                  placeholder="you@example.com"
                  required
                  disabled={!!invitationToken}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number <span className="text-gray-500">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">Minimum 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password_confirmation}
                  onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Notes (only for self-registration) */}
            {!invitationToken && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes <span className="text-gray-500">(optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <textarea
                    value={formData.registration_notes}
                    onChange={(e) => setFormData({ ...formData, registration_notes: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                    placeholder="Any additional information..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </span>
              ) : invitationToken ? (
                'Complete Registration'
              ) : (
                'Submit Application'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
