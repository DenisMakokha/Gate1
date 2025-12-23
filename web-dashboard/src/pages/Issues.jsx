import React, { useState, useEffect } from 'react';
import { issueService } from '../services/api';
import { AlertTriangle, CheckCircle, Clock, ArrowUp, Eye, MessageSquare } from 'lucide-react';

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    loadIssues();
  }, [filter]);

  const loadIssues = async () => {
    try {
      const response = await issueService.getAll({ status: filter !== 'all' ? filter : undefined });
      setIssues(response.data || []);
    } catch (error) {
      console.error('Failed to load issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (issueId) => {
    try {
      await issueService.acknowledge(issueId);
      loadIssues();
    } catch (error) {
      console.error('Failed to acknowledge issue:', error);
    }
  };

  const handleResolve = async (issueId) => {
    try {
      await issueService.resolve(issueId, resolutionNotes);
      setSelectedIssue(null);
      setResolutionNotes('');
      loadIssues();
    } catch (error) {
      console.error('Failed to resolve issue:', error);
    }
  };

  const handleEscalate = async (issueId) => {
    try {
      await issueService.escalate(issueId, 'Escalated by user');
      loadIssues();
    } catch (error) {
      console.error('Failed to escalate issue:', error);
    }
  };

  const severityColors = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const statusColors = {
    open: 'bg-red-50 text-red-700',
    acknowledged: 'bg-yellow-50 text-yellow-700',
    in_progress: 'bg-blue-50 text-blue-700',
    escalated: 'bg-purple-50 text-purple-700',
    resolved: 'bg-green-50 text-green-700',
    closed: 'bg-gray-50 text-gray-700',
  };

  const typeLabels = {
    no_audio: 'No Audio',
    low_audio: 'Low Audio',
    blurry: 'Blurry Video',
    shaky: 'Shaky Video',
    cut_interview: 'Cut Interview',
    filename_error: 'Filename Error',
    duplicate: 'Duplicate',
    other: 'Other',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Issues</h1>
        <p className="text-gray-500">Quality issues and resolution tracking</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'acknowledged', 'in_progress', 'escalated', 'resolved'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
          </button>
        ))}
      </div>

      {/* Issues List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Issue</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Reporter</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {issues.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No issues found
                  </td>
                </tr>
              )}
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{issue.issue_id}</p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {issue.media?.filename || 'Unknown file'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{typeLabels[issue.type] || issue.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[issue.severity]}`}>
                      {issue.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[issue.status]}`}>
                      {issue.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900">{issue.reporter?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{issue.group?.group_code}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {issue.status === 'open' && (
                        <button
                          onClick={() => handleAcknowledge(issue.issue_id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Acknowledge"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {['open', 'acknowledged', 'in_progress'].includes(issue.status) && (
                        <>
                          <button
                            onClick={() => setSelectedIssue(issue)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                            title="Resolve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEscalate(issue.issue_id)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                            title="Escalate"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolve Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Resolve Issue</h2>
            <p className="text-sm text-gray-500 mb-4">
              Issue: {selectedIssue.issue_id} - {typeLabels[selectedIssue.type]}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Describe how the issue was resolved..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedIssue(null);
                  setResolutionNotes('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(selectedIssue.issue_id)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
