require('dotenv').config({ path: '.env.local' });
const { sendPushNotificationByUserId } = require('./src/lib/onesignal');

async function testExternalTargeting() {
    const targetUserId = 'd62a6785-49b2-467b-a5ba-7e889f25b2b0'; // Pavan kumar
    console.log(`🚀 Testing push notification for user ${targetUserId} via External ID...`);

    // This should now succeed in calling OneSignal API even if ID is missing in DB
    const result = await sendPushNotificationByUserId(
        targetUserId,
        'Test Notification',
        'If you see this, External ID targeting is working!',
        { test: true }
    );

    console.log('Final Result:', result ? 'SUCCESS' : 'FAILURE');
}

testExternalTargeting();
