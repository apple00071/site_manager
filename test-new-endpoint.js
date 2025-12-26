// Test with NEW API ENDPOINT: https://api.onesignal.com
const https = require('https');

const ONESIGNAL_APP_ID = 'd080d582-0b88-431c-bb19-59a08f7f5379';
const ONESIGNAL_REST_API_KEY = 'os_v2_app_3aanlaqixbbrzoyzlgqi672tpf5a6xif7zsujefwsnmzclzmb2rg34p6zs3q7o7d4sopklgba5fw7ocmndmogqqoq6vwn6qafqebhoi';

const PLAYER_IDS = [
    '8cb7d92b-e58a-4b4d-8e5e-9107dd0f24ca',
    '18231428-aee6-4cce-a8b4-9399ca96741b',
    'f6da229d-5aa5-4c1e-8f84-fedbb408c5ee'
];

console.log('🎯 Testing with NEW API endpoint: https://api.onesignal.com\n');

const payload = JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: PLAYER_IDS,
    headings: { "en": "🚀 SUCCESS!" },
    contents: { "en": "Push notifications are working!" }
});

const options = {
    hostname: 'api.onesignal.com',  // NEW ENDPOINT!
    path: '/notifications',           // Simplified path!
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
    }
};

console.log('Using endpoint: https://api.onesignal.com/notifications');
console.log('Authorization: Key [API_KEY]');
console.log('\nSending...\n');

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
                console.log(`\n📱 Sent to ${result.recipients} device(s)!`);
                console.log('\n✅ BACKEND NOTIFICATIONS ARE WORKING!');
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
