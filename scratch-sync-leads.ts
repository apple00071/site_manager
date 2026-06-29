import fs from 'fs';

function loadEnv(file: string) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        for (const line of content.split('\n')) {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                process.env[key] = value.trim();
            }
        }
    } catch (e) {
        console.log(`No ${file} found`);
    }
}
loadEnv('.env.local');
loadEnv('.env');

const { supabaseAdmin } = require('./src/lib/supabase-server');
const fallbackLeads = require('./src/app/api/crm/fallback_leads.json');

async function syncLeads() {
    console.log(`Syncing ${fallbackLeads.length} leads to Supabase...`);
    
    if (!supabaseAdmin) {
        console.error('Supabase admin client not initialized. Check environment variables.');
        return;
    }

    // 1. Delete all existing leads to clear test entries like 'tesr'
    const { error: deleteError } = await supabaseAdmin
        .from('quotation_leads')
        .delete()
        .neq('ref_no', 'FORCE_DELETE_NONE'); // delete all
        
    if (deleteError) {
        console.error('Error clearing old quotation leads:', deleteError.message);
        return;
    }
    console.log('Old quotation leads cleared.');

    // 2. Prepare leads for insertion (strip "id" field so DB generates fresh valid UUIDs)
    const toInsert = fallbackLeads.map((lead: any) => {
        const { id, ...rest } = lead;
        return rest;
    });

    // 3. Batch insert leads in chunks
    const chunkSize = 40;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        console.log(`Inserting chunk ${i} to ${Math.min(i + chunkSize, toInsert.length)}...`);
        const { error: insertError } = await supabaseAdmin
            .from('quotation_leads')
            .insert(chunk);
            
        if (insertError) {
            console.error(`Error inserting chunk:`, insertError.message);
            return;
        }
    }
    
    console.log('Success! All leads inserted into Supabase quotation_leads table.');
}

syncLeads();
