import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  console.log("Fetching roles...");
  const { data: roles } = await supabaseAdmin.from('roles').select('*');
  console.log(roles);
  
  if (roles && roles.length > 0) {
    console.log(`Fetching permissions for role: ${roles[0].name}`);
    const { data: rolePerms, error } = await supabaseAdmin
        .from('role_permissions')
        .select(`
            permissions (
                id,
                code,
                module
            )
        `)
        .eq('role_id', roles[0].id);
        
    console.log(JSON.stringify(rolePerms, null, 2));
    if (error) console.error(error);
  }
}

test();
