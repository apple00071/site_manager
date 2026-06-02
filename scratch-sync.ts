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
                process.env[key] = value;
            }
        }
    } catch (e) {
        console.log(`No ${file} found`);
    }
}
loadEnv('.env.local');
loadEnv('.env');

import { supabaseAdmin } from './src/lib/supabase-server';
import { PERMISSION_NODES } from './src/lib/rbac-constants';

async function sync() {
    console.log('Syncing permissions...');
    
    // Get all current permissions
    const { data: existingPermissions } = await supabaseAdmin
        .from('permissions')
        .select('id, code');

    const existingCodes = new Set(existingPermissions?.map((p: any) => p.code) || []);
    const permissionValues = Object.values(PERMISSION_NODES);
    const newPermissions = permissionValues.filter((code: string) => !existingCodes.has(code));

    if (newPermissions.length > 0) {
        const toInsert = newPermissions.map((code: string) => ({
            code,
            module: code.split('.')[0],
            action: code.split('.')[1] || code,
            description: `Permission: ${code}`
        }));

        console.log('Inserting new permissions:', toInsert);
        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('permissions')
            .insert(toInsert)
            .select();

        if (insertError) {
            console.error('Error inserting permissions:', insertError);
            return;
        }
        console.log(`Inserted ${inserted?.length || 0} permissions.`);
    } else {
        console.log('No new permissions to insert.');
    }
    
    // Get Admin role
    const { data: adminRole } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('name', 'Admin')
        .single();

    if (adminRole) {
        const { data: allPermissions } = await supabaseAdmin
            .from('permissions')
            .select('id');

        if (allPermissions && allPermissions.length > 0) {
            await supabaseAdmin
                .from('role_permissions')
                .delete()
                .eq('role_id', adminRole.id);

            const adminPerms = allPermissions.map((p: any) => ({
                role_id: adminRole.id,
                permission_id: p.id
            }));

            const { error: adminPermError } = await supabaseAdmin
                .from('role_permissions')
                .insert(adminPerms);

            if (!adminPermError) {
                console.log('Admin role permissions updated.');
            }
        }
    }
}

sync().catch(console.error);
