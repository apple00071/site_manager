'use client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            maxWidth: '28rem',
            width: '100%'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#dc2626',
              marginBottom: '1rem'
            }}>
              Something went wrong!
            </h2>
            <p style={{
              color: '#374151',
              marginBottom: '1.5rem'
            }}>
              {error.message || 'An unexpected error occurred. Please try again later.'}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#1f2937',
                  borderRadius: '0.25rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Go to Home
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '0.25rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
