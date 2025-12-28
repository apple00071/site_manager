'use client';

import { useState } from 'react';

export default function OneSignalTestPage() {
    const [config, setConfig] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [targetUserId, setTargetUserId] = useState('d62a6785-49b2-467b-a5ba-7e889f25b2b0');
    const [loading, setLoading] = useState(false);

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    const fetchConfig = async () => {
        addLog('Fetching OneSignal configuration...');
        try {
            const res = await fetch('/api/onesignal/test');
            const data = await res.json();
            setConfig(data);
            addLog(`Config: ${JSON.stringify(data)}`);
        } catch (error) {
            addLog(`Error: ${error}`);
        }
    };

    const sendTestNotification = async () => {
        setLoading(true);
        addLog(`Sending test notification to: ${targetUserId}`);
        try {
            const res = await fetch('/api/onesignal/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId }),
            });
            const data = await res.json();
            addLog(`Response (${res.status}): ${JSON.stringify(data, null, 2)}`);

            if (data.result?.errors) {
                addLog(`⚠️ Errors: ${data.result.errors.join(', ')}`);
            }
            if (data.success) {
                addLog('✅ Notification sent successfully!');
            }
        } catch (error) {
            addLog(`❌ Error: ${error}`);
        }
        setLoading(false);
    };

    const clearLogs = () => setLogs([]);

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#1a1a2e'
        }}>
            {/* Left Panel - Controls */}
            <div style={{
                width: '40%',
                padding: '24px',
                borderRight: '1px solid #333',
                color: 'white'
            }}>
                <h1 style={{ marginBottom: '24px', color: '#00d9ff' }}>
                    🔔 OneSignal Push Test
                </h1>

                {/* Config Section */}
                <div style={{ marginBottom: '24px' }}>
                    <button
                        onClick={fetchConfig}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#4a4a6a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        📊 Check Config
                    </button>

                    {config && (
                        <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            backgroundColor: '#2a2a4a',
                            borderRadius: '8px',
                            fontSize: '13px'
                        }}>
                            <div>✅ Configured: {config.configured ? 'Yes' : 'No'}</div>
                            <div>📱 App ID: {config.app_id}</div>
                            <div>🔑 Key Type: {config.api_key_type}</div>
                        </div>
                    )}
                </div>

                {/* Target User */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                        Target User ID (External ID):
                    </label>
                    <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: '#2a2a4a',
                            border: '1px solid #444',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '13px'
                        }}
                    />
                </div>

                {/* Send Button */}
                <button
                    onClick={sendTestNotification}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '16px',
                        backgroundColor: loading ? '#666' : '#00d9ff',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}
                >
                    {loading ? '⏳ Sending...' : '🚀 Send Test Notification'}
                </button>

                <div style={{ marginTop: '24px', fontSize: '12px', color: '#888' }}>
                    <p>This sends a push notification to the specified user via OneSignal API.</p>
                    <p>Check the console on the right for response details.</p>
                </div>
            </div>

            {/* Right Panel - Console */}
            <div style={{
                width: '60%',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                }}>
                    <h2 style={{ color: '#00ff88', margin: 0 }}>📋 Console</h2>
                    <button
                        onClick={clearLogs}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Clear
                    </button>
                </div>

                <div style={{
                    flex: 1,
                    backgroundColor: '#0d0d1a',
                    borderRadius: '8px',
                    padding: '16px',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: '#00ff88'
                }}>
                    {logs.length === 0 ? (
                        <div style={{ color: '#666' }}>
                            Click "Check Config" or "Send Test Notification" to see output...
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} style={{
                                marginBottom: '8px',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all'
                            }}>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
