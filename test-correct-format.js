// CORRECT TEST - lowercase 'key' + new endpoint
const https = require('https');

const ONESIGNAL_APP_ID = 'd080d582-0b88-431c-bb19-59a08f7f5379';
const ONESIGNAL_REST_API_KEY = 'os_v2_app_3aanlaqixbbrzoyzlgqi672tpf5a6xif7zsujefwsnmzclzmb2rg34p6zs3q7o7d4sopklgba5fw7ocmndmogqqoq6vwn6qafqebhoi';

const PLAYER_IDS = [
    '8cb7d92b-e58a-4b4d-8e5e-9107dd0f24ca',
    '18231428-aee6-4cce-a8b4-9399ca96741b',
    'f6da229d-5aa5-4c1e-8f84-fedbb408c5ee'
];

console.log('🎯 CORRECT TEST per OneSignal docs screenshots:\n');
console.log('  - Authorization: key YOUR_API_KEY (lowercase)');
console.log('  - Endpoint: https://api.onesignal.com/notifications\n');

const payload = JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: PLAYER_IDS,
    headings: { "en": "🎉 Push Test" },
    contents: { "en": "Testing with correct format from OneSignal docs!" }
});

const options = {
    hostname: 'api.onesignal.com',
    path: '/notifications',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `key ${ONESIGNAL_REST_API_KEY}`,  // lowercase per docs!
        'Content-Length': Buffer.byteLength(payload)
    }
};

console.log('Sending request...\n');

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('='.repeat(70));

        try {
            const result = JSON.parse(data);
            console.log(JSON.stringify(result, null, 2));

            if (res.statusCode === 200 && result.recipients > 0) {
                console.log('\n' + '='.repeat(70));
                console.log('🎉🎉🎉 SUCCESS! 🎉🎉🎉');
                console.log(`\n📱 Push notification sent to ${result.recipients} device(s)!`);
                console.log('\n✅ BACKEND PUSH NOTIFICATIONS ARE NOW WORKING!');
                console.log('='.repeat(70));
            }
        } catch (e) {
            console.log('Response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
});

req.write(payload);
req.end();
