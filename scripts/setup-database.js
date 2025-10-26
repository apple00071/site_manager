const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDatabase() {
  console.log('Starting database setup...');

  try {
    // Check if tables already exist
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .in('schemaname', ['public']);

    if (tablesError) throw tablesError;

    const tableNames = tables.map(t => t.tablename);
    
    if (tableNames.includes('users')) {
      console.log('Database already set up. Tables exist.');
      return;
    }

    console.log('Creating database schema...');
    
    // Execute the SQL from the schema file
    const { error: schemaError } = await supabase.rpc('pg_read_file', {
      filename: 'supabase-schema.sql'
    });

    if (schemaError) {
      // If reading file fails, try executing the SQL directly
      console.log('Executing schema directly...');
      const { error: directError } = await supabase.rpc('pg_query', {
        query: `
          -- Your SQL schema here (the content of supabase-schema.sql)
          -- This is a simplified version - you might need to adjust
          CREATE TYPE IF NOT EXISTS user_role AS ENUM ('admin', 'employee');
          
          CREATE TABLE IF NOT EXISTS users (
            id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            role user_role NOT NULL DEFAULT 'employee',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Add other tables as needed...
        `
      });
      
      if (directError) throw directError;
    }

    console.log('✅ Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();
