import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Deletion Policy | Apple Interior Manager',
  description: 'How to request the deletion of your account and associated data for the Apple Interior Manager app.',
  robots: {
    index: true,
    follow: true,
  },
};

const APP_NAME = 'Apple Interior Manager';
const COMPANY_NAME = 'Apple Interiors';
const CONTACT_EMAIL = 'contact.appleinteriors@gmail.com';

export default function AccountDeletionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-8 py-8 border-b border-gray-100" style={{ borderTop: '4px solid #f0b100' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f0b100' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Data Deletion Request</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Account & Data Deletion</h1>
            <p className="text-gray-500 text-sm">Instructions for {APP_NAME} users</p>
          </div>

          {/* Content */}
          <div className="px-8 py-8 space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">How to Request Account Deletion</h2>
              <p className="text-gray-600 mb-4">
                If you wish to delete your {APP_NAME} account and all associated personal data, please send an email request to our support team.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                <p className="font-semibold text-amber-900 mb-2">Deletion Request Instructions:</p>
                <ol className="list-decimal list-inside space-y-2 text-amber-800">
                  <li>Send an email to <a href={`mailto:${CONTACT_EMAIL}?subject=Account%20Deletion%20Request`} className="font-bold underline hover:text-amber-600">{CONTACT_EMAIL}</a></li>
                  <li>Use the subject line: <strong>Account Deletion Request</strong></li>
                  <li>Send the email from the address associated with your {APP_NAME} account</li>
                  <li>Include your full name and the name of your organization/tenant (if applicable)</li>
                </ol>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">What Data Will Be Deleted?</h2>
              <p className="text-gray-600 mb-3">Upon receiving a verified deletion request, we will permanently delete or anonymize the following data within 30 days:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Your user account profile (name, email address, password hash)</li>
                <li>Your device identifiers used for push notifications</li>
                <li>Your session and login history logs</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">What Data Is Kept (Retention Policy)?</h2>
              <p className="text-gray-600 mb-3">
                Because {APP_NAME} is an enterprise management tool, certain data created by you during your employment or engagement with {COMPANY_NAME} belongs to the company and must be retained for legal, operational, and auditing purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li><strong>Project & Order Data:</strong> Orders, snags, invoices, and project updates you created or modified will be retained to maintain historical accuracy for the business.</li>
                <li><strong>Attribution:</strong> Retained business records will maintain a reference to your past actions (e.g., "Created by Former User") but will be delinked from your active personal contact profile.</li>
                <li><strong>System Logs:</strong> Aggregated, anonymized system logs may be retained indefinitely for security and performance analysis.</li>
              </ul>
            </section>
            
            <section className="border-t border-gray-100 pt-6 mt-8">
              <p className="text-sm text-gray-500 text-center">
                For complete details on how we handle your data, please see our <a href="/privacy-policy" className="text-[#f0b100] hover:underline font-medium">Privacy Policy</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
