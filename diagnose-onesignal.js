require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseOneSignal() {
    console.log('🔍 Checking OneSignal IDs in database...');

    // Check all users with any OneSignal info
    const { data: users, error } = await supabase
        .from('users')
        .select('id, full_name, onesignal_player_id');

    if (error) {
        console.error('❌ Error fetching users:', error);
        return;
    }

    const withId = users.filter(u => u.onesignal_player_id);
    console.log(`📊 Total users: ${users.length}`);
    console.log(`📊 Users with OneSignal IDs: ${withId.length}`);

    if (withId.length > 0) {
        console.log('✅ Users with IDs:');
        withId.forEach(u => console.log(`  - ${u.full_name}`));
    } else {
        console.log('❌ No users have OneSignal IDs in the database.');
    }

    // Check specific user from logs
    const targetId = 'd62a6785-49b2-467b-a5ba-7e889f25b2b0';
    const target = users.find(u => u.id === targetId);

    if (!target) {
        console.error(`❌ Target user ${targetId} not found in DB`);
    } else {
        console.log(`🎯 Target User Status (${target.full_name}):`);
        console.log(`  - OneSignal ID: ${target.onesignal_player_id || 'EMPTY'}`);
    }
}

diagnoseOneSignal();
