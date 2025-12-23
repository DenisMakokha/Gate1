import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { issueService } from '../services/api';

export default function IssueDetailScreen({ route, navigation }) {
  const { issueId } = route.params;
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);

  useEffect(() => {
    loadIssue();
  }, [issueId]);

  const loadIssue = async () => {
    try {
      const response = await issueService.getOne(issueId);
      setIssue(response);
    } catch (error) {
      console.error('Failed to load issue:', error);
      Alert.alert('Error', 'Failed to load issue details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      await issueService.acknowledge(issueId);
      Alert.alert('Success', 'Issue acknowledged');
      loadIssue();
    } catch (error) {
      Alert.alert('Error', 'Failed to acknowledge issue');
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await issueService.resolve(issueId, resolutionNotes);
      Alert.alert('Success', 'Issue resolved');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve issue');
    } finally {
      setResolving(false);
    }
  };

  const handleEscalate = async () => {
    Alert.alert(
      'Escalate Issue',
      'Are you sure you want to escalate this issue to admin/QA?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          style: 'destructive',
          onPress: async () => {
            try {
              await issueService.escalate(issueId, 'Escalated by group leader');
              Alert.alert('Success', 'Issue escalated');
              loadIssue();
            } catch (error) {
              Alert.alert('Error', 'Failed to escalate issue');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!issue) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Issue not found</Text>
      </View>
    );
  }

  const severityColors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#6b7280',
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.issueId}>{issue.issue_id}</Text>
          <View style={[styles.badge, { backgroundColor: severityColors[issue.severity] + '20' }]}>
            <Text style={[styles.badgeText, { color: severityColors[issue.severity] }]}>
              {issue.severity?.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.issueType}>
          {issue.type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Text>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <Text style={styles.detailValue}>{issue.status?.replace('_', ' ')}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Reporter</Text>
          <Text style={styles.detailValue}>{issue.reporter?.name || 'Unknown'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Group</Text>
          <Text style={styles.detailValue}>{issue.group?.group_code} - {issue.group?.name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Reported</Text>
          <Text style={styles.detailValue}>
            {new Date(issue.created_at).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Media Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Media File</Text>
        <View style={styles.mediaCard}>
          <Text style={styles.filename}>{issue.media?.filename || 'Unknown'}</Text>
          <Text style={styles.mediaId}>{issue.media?.media_id}</Text>
        </View>
      </View>

      {/* Description */}
      {issue.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{issue.description}</Text>
        </View>
      )}

      {/* Resolution Notes */}
      {issue.resolution_notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resolution Notes</Text>
          <Text style={styles.description}>{issue.resolution_notes}</Text>
          <Text style={styles.resolvedBy}>
            Resolved by {issue.resolver?.name} on {new Date(issue.resolved_at).toLocaleString()}
          </Text>
        </View>
      )}

      {/* Actions */}
      {['open', 'acknowledged', 'in_progress'].includes(issue.status) && (
        <View style={styles.actions}>
          {issue.status === 'open' && (
            <TouchableOpacity style={styles.acknowledgeButton} onPress={handleAcknowledge}>
              <Text style={styles.acknowledgeButtonText}>Acknowledge</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.resolveButton}
            onPress={() => setShowResolveModal(true)}
          >
            <Text style={styles.resolveButtonText}>Mark Resolved</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.escalateButton} onPress={handleEscalate}>
            <Text style={styles.escalateButtonText}>Escalate</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Resolve Issue</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Enter resolution notes..."
              value={resolutionNotes}
              onChangeText={setResolutionNotes}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowResolveModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, resolving && styles.buttonDisabled]}
                onPress={handleResolve}
                disabled={resolving}
              >
                <Text style={styles.confirmButtonText}>
                  {resolving ? 'Resolving...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueId: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  issueType: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  mediaCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
  },
  filename: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  mediaId: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  resolvedBy: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 12,
    fontStyle: 'italic',
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  acknowledgeButton: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acknowledgeButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  resolveButton: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resolveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  escalateButton: {
    backgroundColor: '#faf5ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  escalateButtonText: {
    color: '#9333ea',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
