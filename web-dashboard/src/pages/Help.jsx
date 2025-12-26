import React, { useState } from 'react';
import {
  HelpCircle,
  Book,
  Video,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Mail,
  Phone,
  FileText,
  Users,
  Camera,
  HardDrive,
  AlertTriangle,
  Settings,
  Shield,
} from 'lucide-react';

const faqs = [
  {
    category: 'Getting Started',
    icon: Book,
    questions: [
      {
        q: 'How do I set up the Desktop Agent?',
        a: 'Download the Desktop Agent from the downloads section. Install it, then log in with your credentials. The agent will automatically connect to the server and sync your assigned cameras.'
      },
      {
        q: 'How do I join a group?',
        a: 'Groups are assigned by your Group Leader or Admin. Contact them to be added to a specific group. Once added, you\'ll see the group in your dashboard.'
      },
      {
        q: 'What are the different user roles?',
        a: 'Admin: Full system access. Team Lead: Operational management. Group Leader: Manages editors in their group. QA Lead: Quality control oversight. Backup Lead: Storage management. Editor: Media ingestion via Desktop Agent.'
      },
    ]
  },
  {
    category: 'Media Management',
    icon: Video,
    questions: [
      {
        q: 'How do I upload media files?',
        a: 'Media files are uploaded automatically through the Desktop Agent when you process SD cards. Insert the SD card, select the camera, and the agent will sync the files.'
      },
      {
        q: 'What file formats are supported?',
        a: 'The system supports MP4, MOV, AVI for video and JPG, PNG, RAW for images. Maximum file size is determined by your system settings.'
      },
      {
        q: 'How do I search for specific media?',
        a: 'Use the Media Library search. You can filter by date, camera, group, event, and status. Use the advanced search for more specific queries.'
      },
    ]
  },
  {
    category: 'Issues & Quality Control',
    icon: AlertTriangle,
    questions: [
      {
        q: 'How do I report an issue?',
        a: 'Click "Report Issue" from the Issues page or directly from a media item. Select the issue type, add a description, and submit. The issue will be routed to QA.'
      },
      {
        q: 'What happens when an issue is escalated?',
        a: 'Escalated issues are flagged for immediate attention and notify Team Leads. They appear at the top of the issue queue with high priority.'
      },
      {
        q: 'How does the QA review process work?',
        a: 'QA team members review media in the Quality Control queue. They can approve, reject, or flag items for re-processing. Approved items move to the backup queue.'
      },
    ]
  },
  {
    category: 'Backups & Storage',
    icon: HardDrive,
    questions: [
      {
        q: 'How are backups performed?',
        a: 'Backups are managed through the Backup Dashboard. Media is backed up to registered disks. The system tracks backup status and verification for each file.'
      },
      {
        q: 'What does backup verification mean?',
        a: 'Verification ensures backup integrity by comparing checksums. Verified backups are confirmed to be complete and uncorrupted.'
      },
      {
        q: 'How do I check storage capacity?',
        a: 'The Storage Forecast page shows current usage and predictions. You\'ll receive alerts when disks approach capacity thresholds.'
      },
    ]
  },
];

const guides = [
  { title: 'Editor Quick Start Guide', icon: FileText, description: 'Basic guide for new editors' },
  { title: 'Group Leader Handbook', icon: Users, description: 'Managing your team effectively' },
  { title: 'Camera Setup Guide', icon: Camera, description: 'Binding cameras and SD cards' },
  { title: 'Backup Procedures', icon: HardDrive, description: 'Best practices for data backup' },
  { title: 'Quality Control Standards', icon: Shield, description: 'QA review guidelines' },
  { title: 'System Administration', icon: Settings, description: 'Admin configuration guide' },
];

export default function Help() {
  const [expandedCategory, setExpandedCategory] = useState('Getting Started');
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Help & Documentation</h1>
          <p className="text-gray-500">Guides, FAQs, and support resources</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search help articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FAQs */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h2>
          
          {filteredFaqs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No results found for "{searchQuery}"</p>
            </div>
          ) : (
            filteredFaqs.map((category) => (
              <div key={category.category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category.category ? null : category.category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <category.icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900">{category.category}</span>
                    <span className="text-sm text-gray-400">({category.questions.length})</span>
                  </div>
                  {expandedCategory === category.category ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                
                {expandedCategory === category.category && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {category.questions.map((item, idx) => (
                      <div key={idx} className="p-4">
                        <button
                          onClick={() => setExpandedQuestion(expandedQuestion === `${category.category}-${idx}` ? null : `${category.category}-${idx}`)}
                          className="w-full flex items-start justify-between text-left"
                        >
                          <span className="font-medium text-gray-700 pr-4">{item.q}</span>
                          {expandedQuestion === `${category.category}-${idx}` ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                          )}
                        </button>
                        {expandedQuestion === `${category.category}-${idx}` && (
                          <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                            {item.a}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Guides */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Quick Guides</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {guides.map((guide) => (
                <a
                  key={guide.title}
                  href="#"
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                >
                  <guide.icon className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{guide.title}</p>
                    <p className="text-xs text-gray-500">{guide.description}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              ))}
            </div>
          </div>

          {/* Contact Support */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
            <MessageCircle className="w-8 h-8 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Need More Help?</h3>
            <p className="text-blue-100 text-sm mb-4">
              Can't find what you're looking for? Contact our support team.
            </p>
            <div className="space-y-2 text-sm">
              <a href="mailto:support@neliumsystems.com" className="flex items-center gap-2 text-white hover:text-blue-100">
                <Mail className="w-4 h-4" />
                support@neliumsystems.com
              </a>
              <a href="tel:+254700000000" className="flex items-center gap-2 text-white hover:text-blue-100">
                <Phone className="w-4 h-4" />
                +254 700 000 000
              </a>
            </div>
          </div>

          {/* System Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">System Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Version</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Build</span>
                <span className="font-medium">2024.12.26</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Developer</span>
                <span className="font-medium">Nelium Systems</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
