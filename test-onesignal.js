// Test OneSignal with multiple user IDs
const https = require('https');

const ONESIGNAL_APP_ID = 'd080d582-0b88-431c-bb19-59a08f7f5379';
const ONESIGNAL_REST_API_KEY = 'os_v2_app_3aanlaqixbbrzoyzlgqi672tphqpmmwp4mvufb4zs4omzs3x5bh5kgnmwc6a6krmarmqkbyw5kr2mesbggxaujlr2axfsl3nnzpb6ya';

// Try these user IDs from the database screenshot
const TEST_USER_IDS = [
    '1a7e6f74-068b-40be-9bad-0adf7e66aaaf', // admin@appleinteriors.in
    '4d13ad9c-5524-4b1e-bc74-0484879191f26', // Jyothika
    'd160912b-a140-4702-b701-cf9aa23c0538', // SivaKumar
];

console.log('Testing push notifications with multiple user IDs...\n');

function sendTestNotification(userId, index) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [userId],
            headings: { en: `Test ${index + 1}` },
            contents: { en: `Testing push notification for user: ${userId.substring(0, 8)}...` },
        });

        const options = {
            hostname: 'onesignal.com',
            path: '/api/v1/notifications',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + ONESIGNAL_REST_API_KEY,
                'Content-Length': payload.length,
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`User ${index + 1} (${userId.substring(0, 8)}...):`,
                        result.recipients > 0 ? `✅ ${result.recipients} device(s)` : '❌ 0 devices');
                    if (result.recipients > 0) {
                        console.log('  → Notification ID:', result.id);
                    }
                    resolve(result);
                } catch (e) {
                    console.log(`User ${index + 1}: Error parsing response`);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`User ${index + 1}: Error -`, e.message);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
}

async function testAll() {
    for (let i = 0; i < TEST_USER_IDS.length; i++) {
        await sendTestNotification(TEST_USER_IDS[i], i);
        await new Promise(r => setTimeout(r, 1000)); // Wait 1 second between tests
    }

    console.log('\n📱 If any notification was sent, check your Android device!');
    console.log('\nIf all show 0 devices:');
    console.log('1. Open the Android app');
    console.log('2. Log in with a user account');
    console.log('3. Check OneSignal dashboard → Audience to verify user subscribed');
    console.log('4. Run this test again');
}

testAll();
