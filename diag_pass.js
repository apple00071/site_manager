const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uswdtcmemgfqlkzmfkxs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd2R0Y21lbWdmcWxrem1ma3hzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNzg1OCwiZXhwIjoyMDc2OTEzODU4fQ.4k5EGYhCQ1V3WvxjIHCfoPdRnw7CBhWIiSmkhqRJNKA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPasswords() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('full_name, email, password_changed');

        if (error) {
            console.error('DATABASE_ERROR:', JSON.stringify(error));
            process.exit(1);
        }

        console.log('--- START ---');
        if (!data || data.length === 0) {
            console.log('NO_USERS_FOUND');
        } else {
            data.forEach(u => {
                const isChanged = u.password_changed === true ? 'SECURE' : 'TEMP';
                console.log(`${isChanged}: ${u.full_name} (${u.email})`);
            });
        }
        console.log('--- END ---');
        process.exit(0);
    } catch (err) {
        console.error('SYSTEM_ERROR:', err.message);
        process.exit(1);
    }
}

checkPasswords();
