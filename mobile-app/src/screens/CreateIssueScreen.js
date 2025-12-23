import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function CreateIssueScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const [formData, setFormData] = useState({
    type: 'filename_issue',
    severity: 'medium',
    description: '',
    media_id: '',
  });

  const issueTypes = [
    { value: 'filename_issue', label: 'Filename Issue', icon: 'document-text' },
    { value: 'missing_file', label: 'Missing File', icon: 'alert-circle' },
    { value: 'corrupt_file', label: 'Corrupt File', icon: 'warning' },
    { value: 'sync_error', label: 'Sync Error', icon: 'sync' },
    { value: 'quality_issue', label: 'Quality Issue', icon: 'eye' },
    { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  const severityLevels = [
    { value: 'low', label: 'Low', color: '#22c55e' },
    { value: 'medium', label: 'Medium', color: '#f59e0b' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'critical', label: 'Critical', color: '#ef4444' },
  ];

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await api.get('/groups');
      setGroups(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    setLoading(true);
    try {
      await api.post('/issues/report', {
        ...formData,
        group_id: selectedGroup?.id,
      });
      Alert.alert('Success', 'Issue reported successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to report issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Issue</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Issue Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issue Type</Text>
            <View style={styles.typeGrid}>
              {issueTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeCard,
                    formData.type === type.value && styles.typeCardActive,
                  ]}
                  onPress={() => setFormData({ ...formData, type: type.value })}
                >
                  <Ionicons
                    name={type.icon}
                    size={24}
                    color={formData.type === type.value ? '#0ea5e9' : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      formData.type === type.value && styles.typeLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Severity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Severity</Text>
            <View style={styles.severityRow}>
              {severityLevels.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.severityButton,
                    formData.severity === level.value && {
                      backgroundColor: level.color + '20',
                      borderColor: level.color,
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, severity: level.value })}
                >
                  <View
                    style={[styles.severityDot, { backgroundColor: level.color }]}
                  />
                  <Text
                    style={[
                      styles.severityLabel,
                      formData.severity === level.value && { color: level.color },
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Group Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group (Optional)</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowGroupPicker(!showGroupPicker)}
            >
              <Text style={selectedGroup ? styles.selectText : styles.selectPlaceholder}>
                {selectedGroup ? `${selectedGroup.group_code} - ${selectedGroup.name}` : 'Select a group...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9ca3af" />
            </TouchableOpacity>
            {showGroupPicker && (
              <View style={styles.pickerDropdown}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedGroup(null);
                    setShowGroupPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>None</Text>
                </TouchableOpacity>
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setSelectedGroup(group);
                      setShowGroupPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>
                      {group.group_code} - {group.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Media ID */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Media ID (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter media ID if applicable"
              placeholderTextColor="#9ca3af"
              value={formData.media_id}
              onChangeText={(text) => setFormData({ ...formData, media_id: text })}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the issue in detail..."
              placeholderTextColor="#9ca3af"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    width: '31%',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  typeCardActive: {
    borderColor: '#0ea5e9',
    backgroundColor: '#e0f2fe',
  },
  typeLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
  typeLabelActive: {
    color: '#0ea5e9',
    fontWeight: '500',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectText: {
    fontSize: 15,
    color: '#1f2937',
  },
  selectPlaceholder: {
    fontSize: 15,
    color: '#9ca3af',
  },
  pickerDropdown: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  pickerItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#1f2937',
  },
  input: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#1f2937',
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#10b981',
    borderRadius: 12,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
