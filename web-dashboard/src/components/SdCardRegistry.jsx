import React, { useState, useEffect } from 'react';
import { dashboardService } from '../services/api';
import { 
  HardDrive, Camera, RefreshCw, CheckCircle, AlertTriangle, 
  Clock, User, Activity, Circle
} from 'lucide-react';

export default function SdCardRegistry({ eventId }) {
  const [sdCards, setSdCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, in_use, available

  useEffect(() => {
    loadSdCards();
  }, [eventId]);

  const loadSdCards = async () => {
    setLoading(true);
    try {
      const response = await dashboardService.getSdCardLifecycle(eventId);
      setSdCards(response.sd_cards || []);
    } catch (error) {
      console.error('Failed to load SD cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCards = sdCards.filter(card => {
    if (filter === 'in_use') return card.status === 'in_use';
    if (filter === 'available') return card.status === 'available';
    return true;
  });

  const getStatusBadge = (status) => {
    if (status === 'in_use') {
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
          <Circle className="w-2 h-2 fill-emerald-500" />
          In Use
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
        <Circle className="w-2 h-2 fill-gray-400" />
        Available
      </span>
    );
  };

  const getReliabilityColor = (score) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <HardDrive className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">SD Card Registry</h2>
              <p className="text-sm text-gray-500">Track all registered SD cards and their usage</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="all">All Cards ({sdCards.length})</option>
              <option value="in_use">In Use ({sdCards.filter(c => c.status === 'in_use').length})</option>
              <option value="available">Available ({sdCards.filter(c => c.status === 'available').length})</option>
            </select>
            <button
              onClick={loadSdCards}
              className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredCards.length > 0 ? (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => (
            <div 
              key={card.sd_label}
              className={`border rounded-xl p-4 transition-all ${
                card.status === 'in_use' 
                  ? 'border-emerald-200 bg-emerald-50/50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    card.status === 'in_use' ? 'bg-emerald-100' : 'bg-gray-100'
                  }`}>
                    <HardDrive className={`w-5 h-5 ${
                      card.status === 'in_use' ? 'text-emerald-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{card.sd_label}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Camera className="w-3 h-3" />
                      Camera {card.camera_number}
                    </div>
                  </div>
                </div>
                {getStatusBadge(card.status)}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Sessions</span>
                  <span className="font-medium text-gray-900">{card.total_sessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed</span>
                  <span className="font-medium text-emerald-600">{card.completed_sessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Early Removals</span>
                  <span className={`font-medium ${card.early_removals > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                    {card.early_removals}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reliability</span>
                  <span className={`font-medium ${getReliabilityColor(card.reliability_score)}`}>
                    {card.reliability_score}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Files Processed</span>
                  <span className="font-medium text-gray-900">{card.total_files_processed?.toLocaleString() || 0}</span>
                </div>
              </div>

              {card.last_used && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  Last used: {new Date(card.last_used).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center">
          <HardDrive className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No SD cards registered</p>
          <p className="text-sm text-gray-400 mt-1">Cards will appear when editors bind them</p>
        </div>
      )}

      {/* Summary Stats */}
      {sdCards.length > 0 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{sdCards.length}</p>
              <p className="text-xs text-gray-500">Total Cards</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {sdCards.filter(c => c.status === 'in_use').length}
              </p>
              <p className="text-xs text-gray-500">In Use</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">
                {sdCards.reduce((sum, c) => sum + (c.total_sessions || 0), 0)}
              </p>
              <p className="text-xs text-gray-500">Total Sessions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {sdCards.reduce((sum, c) => sum + (c.early_removals || 0), 0)}
              </p>
              <p className="text-xs text-gray-500">Early Removals</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
