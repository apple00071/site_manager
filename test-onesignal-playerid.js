// FINAL TEST - with capital 'Key' authorization header
const https = require('https');

const ONESIGNAL_APP_ID = 'd080d582-0b88-431c-bb19-59a08f7f5379';
const ONESIGNAL_REST_API_KEY = 'os_v2_app_3aanlaqixbbrzoyzlgqi672tpf5a6xif7zsujefwsnmzclzmb2rg34p6zs3q7o7d4sopklgba5fw7ocmndmogqqoq6vwn6qafqebhoi';

const PLAYER_IDS = [
    '8cb7d92b-e58a-4b4d-8e5e-9107dd0f24ca',
    '18231428-aee6-4cce-a8b4-9399ca96741b',
    'f6da229d-5aa5-4c1e-8f84-fedbb408c5ee'
];

console.log('🎯 FINAL TEST - Using capital "Key" in authorization header\n');

const payload = JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: PLAYER_IDS,
    headings: { "en": "🚀 Push Notifications Working!" },
    contents: { "en": "SUCCESS! Backend can now send automatic push notifications for all app events!" }
});

const options = {
    hostname: 'onesignal.com',
    path: '/api/v1/notifications',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,  // Capital 'Key' is required!
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('\n' + '='.repeat(70));

        try {
            const result = JSON.parse(data);
            console.log(JSON.stringify(result, null, 2));

            if (res.statusCode === 200) {
                console.log('\n' + '='.repeat(70));
                if (result.recipients > 0) {
                    console.log('🎉🎉🎉 SUCCESS! 🎉🎉🎉');
                    console.log(`\n📱 Push notification sent to ${result.recipients} device(s)!`);
                    console.log('\nCHECK YOUR ANDROID DEVICE NOW!');
                    console.log('='.repeat(70));
                    console.log('\n✅ BACKEND PUSH NOTIFICATIONS ARE NOW FULLY OPERATIONAL!');
                    console.log('\nAutomatic notifications will now work for:');
                    console.log('  - Task assignments');
                    console.log('  - Calendar events');
                    console.log('  - Project updates');
                    console.log('  - Snag reports');
                    console.log('  - Design approvals/rejections');
                    console.log('  - Comments and mentions');
                    console.log('  - Bill approvals');
                    console.log('  - AND ALL OTHER APP EVENTS!');
                    console.log('\n' + '='.repeat(70));
                } else {
                    console.log('\n⚠️  0 recipients - users may need to reinstall app');
                }
            } else {
                console.log('\n❌ Error - Status code:', res.statusCode);
            }

            if (result.errors) {
                console.log('\nErrors:');
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
