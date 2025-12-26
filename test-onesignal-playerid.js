// Test with correct OneSignal API authentication format
const https = require('https');

const ONESIGNAL_APP_ID = 'd080d582-0b88-431c-bb19-59a08f7f5379';
const ONESIGNAL_REST_API_KEY = 'os_v2_app_3aanlaqixbbrzoyzlgqi672tphqh2ja4bxmu3qfdhmekciq32qiqdnpchmu7xo7jfxbqeizvwq4qjjfyq63bgfqfv7wvtpezit4kbri';

// OneSignal Player IDs from the dashboard
const PLAYER_IDS = [
    '18231428-aee6-4cce-a8b4-9399ca96741b',
    'f6da229d-5aa5-4c1e-8f84-fedbb408c5ee'
];

console.log('🧪 Sending test notification with CORRECT auth format...\n');

const payload = JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: PLAYER_IDS,
    headings: { "en": "🎉 Push Notification Test" },
    contents: { "en": "Success! If you see this, push notifications are working!" }
});

const options = {
    hostname: 'onesignal.com',
    path: '/api/v1/notifications',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `key ${ONESIGNAL_REST_API_KEY}`,  // FIXED: Using 'key' instead of 'Basic'
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('\n' + '='.repeat(50));

        try {
            const result = JSON.parse(data);
            console.log('Response:', JSON.stringify(result, null, 2));

            if (result.recipients !== undefined) {
                if (result.recipients > 0) {
                    console.log('\n' + '='.repeat(50));
                    console.log('✅ SUCCESS! Notification sent to', result.recipients, 'device(s)!');
                    console.log('📱 CHECK YOUR ANDROID DEVICE NOW!');
                    console.log('='.repeat(50));
                } else {
                    console.log('\n⚠️  0 recipients - users may not be subscribed');
                }
            }

            if (result.errors) {
                console.log('\n❌ ERRORS:');
                result.errors.forEach(err => console.log('  -', err));
            }
        } catch (e) {
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ Error:', e.message);
});

req.write(payload);
req.end();
