import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LiveOperations from '../components/LiveOperations';
import SdCardRegistry from '../components/SdCardRegistry';
import BackupDriveStatus from '../components/BackupDriveStatus';
import AttentionQueue from '../components/AttentionQueue';
import EditorProductivity from '../components/EditorProductivity';
import { 
  Activity, HardDrive, Database, Bell, TrendingUp, 
  Radio, LayoutGrid
} from 'lucide-react';

const tabs = [
  { id: 'live', label: 'Live Monitor', icon: Radio },
  { id: 'attention', label: 'Attention Queue', icon: Bell },
  { id: 'sdcards', label: 'SD Cards', icon: HardDrive },
  { id: 'backup', label: 'Backup Status', icon: Database },
  { id: 'productivity', label: 'Productivity', icon: TrendingUp },
];

export default function Operations() {
  const { activeEvent, isAdmin, isTeamLead, isGroupLeader } = useAuth();
  const [activeTab, setActiveTab] = useState('live');

  const hasAccess = isAdmin() || isTeamLead() || isGroupLeader();

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">You don't have access to operations monitoring</p>
        </div>
      </div>
    );
  }

  const eventId = activeEvent?.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Center</h1>
          <p className="text-gray-500">Real-time monitoring and operational oversight</p>
        </div>
        {activeEvent && (
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-700">
              <span className="font-medium">Active Event:</span> {activeEvent.name}
            </p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-sky-100 text-sky-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'live' && <LiveOperations eventId={eventId} />}
        {activeTab === 'attention' && <AttentionQueue eventId={eventId} />}
        {activeTab === 'sdcards' && <SdCardRegistry eventId={eventId} />}
        {activeTab === 'backup' && <BackupDriveStatus eventId={eventId} />}
        {activeTab === 'productivity' && <EditorProductivity eventId={eventId} />}
      </div>
    </div>
  );
}
