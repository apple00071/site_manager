import { supabaseAdmin } from './src/lib/supabase-server';

async function diagnoseOneSignal() {
    console.log('🔍 Checking OneSignal IDs in database...');

    // Check all users with any OneSignal info
    const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, full_name, onesignal_player_id')
        .not('onesignal_player_id', 'is', null);

    if (error) {
        console.error('❌ Error fetching users:', error);
        return;
    }

    console.log(`📊 Found ${users.length} users with OneSignal IDs:`);
    users.forEach(u => {
        console.log(`- ${u.full_name} (${u.id}): ${u.onesignal_player_id}`);
    });

    // Check specific user from logs
    const targetId = 'd62a6785-49b2-467b-a5ba-7e889f25b2b0';
    const { data: target, error: targetError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, onesignal_player_id')
        .eq('id', targetId)
        .single();

    if (targetError) {
        console.error(`❌ Error fetching target user ${targetId}:`, targetError);
    } else {
        console.log(`🎯 Target User Status (${target.full_name}):`);
        console.log(`  - OneSignal ID: ${target.onesignal_player_id || 'EMPTY'}`);
    }
}

diagnoseOneSignal();
