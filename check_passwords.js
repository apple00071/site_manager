const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uswdtcmemgfqlkzmfkxs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd2R0Y21lbWdmcWxrem1ma3hzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNzg1OCwiZXhwIjoyMDc2OTEzODU4fQ.4k5EGYhCQ1V3WvxjIHCfoPdRnw7CBhWIiSmkhqRJNKA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPasswords() {
    const { data, error } = await supabase
        .from('users')
        .select('full_name, email, password_changed');

    if (error) {
        console.error('ERROR:', error);
        process.exit(1);
    }

    console.log('--- PASSWORD STATUS REPORT ---');
    data.forEach(u => {
        const status = u.password_changed ? 'SECURE' : 'TEMPORARY';
        console.log(`[${status}] ${u.full_name} <${u.email}>`);
    });
    console.log('--- END OF REPORT ---');
    process.exit(0);
}

checkPasswords();
