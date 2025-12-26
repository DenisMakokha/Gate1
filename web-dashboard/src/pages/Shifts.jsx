import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Clock,
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  User,
  PlayCircle,
  StopCircle,
  AlertCircle,
} from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const mockShifts = [
  { id: 1, userId: 1, userName: 'John Doe', date: '2024-12-26', startHour: 8, endHour: 16, status: 'active', checkedIn: true },
  { id: 2, userId: 2, userName: 'Jane Smith', date: '2024-12-26', startHour: 16, endHour: 24, status: 'scheduled' },
  { id: 3, userId: 3, userName: 'Mike Johnson', date: '2024-12-26', startHour: 8, endHour: 16, status: 'completed' },
  { id: 4, userId: 1, userName: 'John Doe', date: '2024-12-27', startHour: 8, endHour: 16, status: 'scheduled' },
  { id: 5, userId: 4, userName: 'Sarah Wilson', date: '2024-12-27', startHour: 16, endHour: 24, status: 'scheduled' },
];

const mockEditors = [
  { id: 1, name: 'John Doe' },
  { id: 2, name: 'Jane Smith' },
  { id: 3, name: 'Mike Johnson' },
  { id: 4, name: 'Sarah Wilson' },
  { id: 5, name: 'Tom Brown' },
];

export default function Shifts() {
  const { isAdmin, isTeamLead, isGroupLeader } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week'); // 'day', 'week'
  const [shifts, setShifts] = useState(mockShifts);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [formData, setFormData] = useState({
    userId: '',
    startHour: 8,
    endHour: 16,
  });

  const canManageShifts = isAdmin() || isTeamLead() || isGroupLeader();

  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const getShiftsForDate = (date) => {
    return shifts.filter(s => s.date === formatDate(date));
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const handleSlotClick = (date, hour) => {
    if (!canManageShifts) return;
    setSelectedSlot({ date: formatDate(date), hour });
    setFormData({ userId: '', startHour: hour, endHour: hour + 8 });
    setShowModal(true);
  };

  const handleCreateShift = () => {
    if (!formData.userId) return;
    
    const editor = mockEditors.find(e => e.id === parseInt(formData.userId));
    const newShift = {
      id: Date.now(),
      userId: parseInt(formData.userId),
      userName: editor?.name || 'Unknown',
      date: selectedSlot.date,
      startHour: parseInt(formData.startHour),
      endHour: parseInt(formData.endHour),
      status: 'scheduled',
    };
    
    setShifts(prev => [...prev, newShift]);
    setShowModal(false);
  };

  const getShiftColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 border-green-300 text-green-800';
      case 'completed': return 'bg-gray-100 border-gray-300 text-gray-600';
      case 'scheduled': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-600';
    }
  };

  const todayStats = {
    scheduled: shifts.filter(s => s.date === formatDate(new Date()) && s.status === 'scheduled').length,
    active: shifts.filter(s => s.date === formatDate(new Date()) && s.status === 'active').length,
    completed: shifts.filter(s => s.date === formatDate(new Date()) && s.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Schedule</h1>
          <p className="text-gray-500">Manage editor work schedules</p>
        </div>
        {canManageShifts && (
          <button
            onClick={() => {
              setSelectedSlot({ date: formatDate(new Date()), hour: 8 });
              setFormData({ userId: '', startHour: 8, endHour: 16 });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Shift
          </button>
        )}
      </div>

      {/* Today's Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{todayStats.scheduled}</p>
              <p className="text-sm text-gray-500">Scheduled Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <PlayCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{todayStats.active}</p>
              <p className="text-sm text-gray-500">Currently Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Check className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{todayStats.completed}</p>
              <p className="text-sm text-gray-500">Completed Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-gray-900">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </h2>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Today
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-8 border-b border-gray-100">
              <div className="p-3 text-center text-sm font-medium text-gray-500 border-r border-gray-100">
                Time
              </div>
              {weekDates.map((date, i) => {
                const isToday = formatDate(date) === formatDate(new Date());
                return (
                  <div
                    key={i}
                    className={`p-3 text-center border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    <p className="text-sm font-medium text-gray-500">{DAYS[date.getDay()]}</p>
                    <p className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                      {date.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Time slots */}
            {[6, 8, 10, 12, 14, 16, 18, 20, 22].map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
                <div className="p-2 text-center text-sm text-gray-500 border-r border-gray-100 bg-gray-50">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {weekDates.map((date, i) => {
                  const dayShifts = getShiftsForDate(date).filter(
                    s => s.startHour <= hour && s.endHour > hour
                  );
                  const isToday = formatDate(date) === formatDate(new Date());
                  
                  return (
                    <div
                      key={i}
                      onClick={() => handleSlotClick(date, hour)}
                      className={`p-1 min-h-[60px] border-r border-gray-100 last:border-r-0 ${
                        isToday ? 'bg-blue-50/50' : ''
                      } ${canManageShifts ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    >
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          className={`px-2 py-1 rounded text-xs font-medium border ${getShiftColor(shift.status)} mb-1`}
                        >
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {shift.userName}
                          </div>
                          <div className="text-[10px] opacity-75">
                            {shift.startHour}:00 - {shift.endHour}:00
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Shift Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Schedule Shift</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={selectedSlot?.date || ''}
                  onChange={(e) => setSelectedSlot(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Editor</label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select editor...</option>
                  {mockEditors.map(editor => (
                    <option key={editor.id} value={editor.id}>{editor.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <select
                    value={formData.startHour}
                    onChange={(e) => setFormData(prev => ({ ...prev, startHour: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {HOURS.map(h => (
                      <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <select
                    value={formData.endHour}
                    onChange={(e) => setFormData(prev => ({ ...prev, endHour: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {HOURS.map(h => (
                      <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateShift}
                  disabled={!formData.userId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
