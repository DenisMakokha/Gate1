import React, { useState, useEffect } from 'react';
import { backupService } from '../services/api';
import { 
  HardDrive, RefreshCw, CheckCircle, AlertTriangle, 
  Database, Shield, Clock, TrendingUp
} from 'lucide-react';

export default function BackupDriveStatus({ eventId }) {
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackupData();
  }, [eventId]);

  const loadBackupData = async () => {
    setLoading(true);
    try {
      const response = await backupService.getCoverage(eventId);
      setCoverage(response);
    } catch (error) {
      console.error('Failed to load backup coverage:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (percentage) => {
    if (percentage >= 90) return 'text-emerald-600';
    if (percentage >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getHealthBg = (percentage) => {
    if (percentage >= 90) return 'bg-emerald-500';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const backupPercentage = coverage?.summary?.backup_percentage || 0;
  const verifiedPercentage = coverage?.summary?.verified_percentage || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Database className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Backup Status</h2>
              <p className="text-sm text-gray-500">Data protection and verification overview</p>
            </div>
          </div>
          <button
            onClick={loadBackupData}
            className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Backup Coverage */}
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-600" />
                <span className="font-medium text-gray-700">Backup Coverage</span>
              </div>
              <span className={`text-2xl font-bold ${getHealthColor(backupPercentage)}`}>
                {backupPercentage}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getHealthBg(backupPercentage)} transition-all duration-500`}
                style={{ width: `${backupPercentage}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <span>{coverage?.summary?.backed_up || 0} backed up</span>
              <span>{coverage?.summary?.total_media || 0} total</span>
            </div>
          </div>

          {/* Verified Coverage */}
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <span className="font-medium text-gray-700">Verified Backups</span>
              </div>
              <span className={`text-2xl font-bold ${getHealthColor(verifiedPercentage)}`}>
                {verifiedPercentage}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getHealthBg(verifiedPercentage)} transition-all duration-500`}
                style={{ width: `${verifiedPercentage}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <span>{coverage?.summary?.verified || 0} verified</span>
              <span>{coverage?.summary?.backed_up || 0} backed up</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-sky-50 rounded-xl">
            <p className="text-3xl font-bold text-sky-700">{coverage?.summary?.total_media || 0}</p>
            <p className="text-sm text-sky-600">Total Files</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <p className="text-3xl font-bold text-purple-700">{coverage?.summary?.backed_up || 0}</p>
            <p className="text-sm text-purple-600">Backed Up</p>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-xl">
            <p className="text-3xl font-bold text-emerald-700">{coverage?.summary?.verified || 0}</p>
            <p className="text-sm text-emerald-600">Verified</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl">
            <p className="text-3xl font-bold text-amber-700">{coverage?.summary?.pending || 0}</p>
            <p className="text-sm text-amber-600">Pending</p>
          </div>
        </div>

        {/* Backup Disks */}
        {coverage?.disks?.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-gray-500" />
              Backup Drives
            </h3>
            <div className="space-y-3">
              {coverage.disks.map((disk) => (
                <div 
                  key={disk.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      disk.is_connected ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}>
                      <HardDrive className={`w-6 h-6 ${
                        disk.is_connected ? 'text-emerald-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{disk.disk_label}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>{disk.files_count || 0} files</span>
                        <span>•</span>
                        <span>{disk.size_formatted || '0 B'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {disk.space_used_percentage !== undefined && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {disk.space_used_percentage}% used
                        </p>
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full ${
                              disk.space_used_percentage > 90 ? 'bg-red-500' :
                              disk.space_used_percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${disk.space_used_percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      disk.is_connected 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {disk.is_connected ? 'Connected' : 'Offline'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Health Status */}
        <div className="mt-6 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            {verifiedPercentage >= 90 ? (
              <>
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <div>
                  <p className="font-medium text-emerald-700">Backup Health: Excellent</p>
                  <p className="text-sm text-gray-500">All critical data is protected and verified</p>
                </div>
              </>
            ) : verifiedPercentage >= 70 ? (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-700">Backup Health: Needs Attention</p>
                  <p className="text-sm text-gray-500">Some files are pending backup or verification</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <div>
                  <p className="font-medium text-red-700">Backup Health: Critical</p>
                  <p className="text-sm text-gray-500">Many files are not backed up - immediate action required</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
