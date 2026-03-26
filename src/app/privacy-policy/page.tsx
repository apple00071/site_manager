import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Apple Interior Manager',
  description: 'Privacy Policy for Apple Interior Manager app — how we collect, use, and protect your data.',
  robots: {
    index: true,
    follow: true,
  },
};

const LAST_UPDATED = 'March 26, 2026';
const APP_NAME = 'Apple Interior Manager';
const COMPANY_NAME = 'Apple Interiors';
const CONTACT_EMAIL = 'contact.appleinteriors@gmail.com';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-8 py-8 border-b border-gray-100"
            style={{ borderTop: '4px solid #f0b100' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#f0b100' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Legal</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 text-sm">Last updated: {LAST_UPDATED}</p>
          </div>

          {/* Content */}
          <div className="px-8 py-8 space-y-8">

            <Section title="1. Introduction">
              <p>
                Welcome to <strong>{APP_NAME}</strong>, operated by <strong>{COMPANY_NAME}</strong>. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and web platform. Please read this policy carefully. If you disagree with its terms, please discontinue use of the application.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p>We may collect the following types of information:</p>
              <SubList items={[
                { label: 'Account Information', text: 'Name, email address, and password when you register an account.' },
                { label: 'Business Data', text: 'Project details, client information, invoices, orders, and snag data you enter into the app.' },
                { label: 'Device Information', text: 'Device type, operating system, unique device identifiers, and push notification tokens.' },
                { label: 'Usage Data', text: 'App features accessed, pages visited, timestamps, and interaction logs.' },
                { label: 'Communications', text: 'Messages or support requests you send us.' },
              ]} />
            </Section>

            <Section title="3. How We Use Your Information">
              <p>We use the collected information to:</p>
              <BulletList items={[
                'Provide, operate, and maintain the application.',
                'Manage your account and authenticate you securely.',
                'Send push notifications for project updates and task reminders (only with your permission).',
                'Improve, personalize, and expand our services.',
                'Communicate with you about updates, support, or changes to our policies.',
                'Prevent fraud and ensure platform security.',
                'Comply with legal obligations.',
              ]} />
            </Section>

            <Section title="4. Third-Party Services">
              <p>We use the following third-party services that may collect or process your data:</p>
              <SubList items={[
                { label: 'Supabase', text: 'Our backend database and authentication provider. Your data is stored securely on Supabase infrastructure. See their privacy policy at supabase.com/privacy.' },
                { label: 'OneSignal', text: 'Used to send push notifications. OneSignal may collect device identifiers. See their privacy policy at onesignal.com/privacy-policy.' },
                { label: 'Vercel', text: 'Our hosting platform. See their privacy policy at vercel.com/legal/privacy-policy.' },
              ]} />
              <p className="mt-3 text-sm text-gray-500">
                We do not sell your personal data to any third parties.
              </p>
            </Section>

            <Section title="5. Data Storage & Retention">
              <p>
                Your data is stored on secure cloud servers. We retain your personal information for as long as your account is active or as needed to provide you services. You may request deletion of your account and associated data at any time by contacting us at the email below.
              </p>
            </Section>

            <Section title="6. Data Security">
              <p>
                We implement industry-standard security measures including encrypted connections (HTTPS/TLS), row-level security in our database, and secure authentication tokens. However, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.
              </p>
            </Section>

            <Section title="7. Children's Privacy">
              <p>
                {APP_NAME} is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately so we can take appropriate action.
              </p>
            </Section>

            <Section title="8. Your Rights">
              <p>Depending on your location, you may have the right to:</p>
              <BulletList items={[
                'Access the personal data we hold about you.',
                'Request correction of inaccurate data.',
                'Request deletion of your personal data.',
                'Withdraw consent for data processing where applicable.',
                'Lodge a complaint with a data protection authority.',
              ]} />
              <p className="mt-3">
                To exercise any of these rights, please contact us at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium hover:underline"
                  style={{ color: '#f0b100' }}>
                  {CONTACT_EMAIL}
                </a>.
              </p>
            </Section>

            <Section title="9. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any significant changes by updating the "Last updated" date at the top of this page. Continued use of the app after changes constitutes your acceptance of the updated policy.
              </p>
            </Section>

            <Section title="10. Contact Us">
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us:
              </p>
              <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-800">{COMPANY_NAME}</p>
                <p className="text-gray-600 mt-1">
                  Email:{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium hover:underline"
                    style={{ color: '#f0b100' }}>
                    {CONTACT_EMAIL}
                  </a>
                </p>
              </div>
            </Section>

          </div>

          {/* Footer */}
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 mt-2 text-gray-600">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function SubList({ items }: { items: { label: string; text: string }[] }) {
  return (
    <ul className="space-y-2 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full mt-2"
            style={{ backgroundColor: '#f0b100' }} />
          <span>
            <strong className="text-gray-800">{item.label}:</strong>{' '}
            <span className="text-gray-600">{item.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
