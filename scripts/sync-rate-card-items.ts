import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file: string) {
  try {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
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
    console.log(`Error loading ${file}:`, e);
  }
}

loadEnv('.env.local');
loadEnv('.env');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase URL or Service Role Key in environment');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const UPDATED_RATE_CARD_ITEMS = [
  // Kitchen Platform
  {
    section: 'Kitchen Platform',
    item_name: 'Granite Top — Kitchen, Hand Wash, Crockery, Pooja (base ₹220)',
    unit: 'sqft',
    default_rate: 300,
    is_lumpsum: false,
    sort_order: 1,
    is_active: true
  },
  {
    section: 'Kitchen Platform',
    item_name: 'Dado Tiles (LSM)',
    unit: 'lumpsum',
    default_rate: 12000,
    is_lumpsum: true,
    sort_order: 2,
    is_active: true
  },
  {
    section: 'Kitchen Platform',
    item_name: 'Labour Charges — Granite & Tile Laying (LSM)',
    unit: 'lumpsum',
    default_rate: 30000,
    is_lumpsum: true,
    sort_order: 3,
    is_active: true
  },
  // False Ceiling
  {
    section: 'False Ceiling',
    item_name: 'False Ceiling — Entire Flat except Washrooms',
    unit: 'sqft',
    default_rate: 67,
    is_lumpsum: false,
    sort_order: 1,
    is_active: true
  },
  // Painting
  {
    section: 'Painting',
    item_name: 'False Ceiling Paint — 2 coat Birla Putty, 1 coat Primer, 2 coat Premium Paint',
    unit: 'sqft',
    default_rate: 34,
    is_lumpsum: false,
    sort_order: 1,
    is_active: true
  },
  {
    section: 'Painting',
    item_name: 'Wall Paint — Touch-ups & 2 coat Asian Royal Aspira (LSM)',
    unit: 'lumpsum',
    default_rate: 40000,
    is_lumpsum: true,
    sort_order: 2,
    is_active: true
  },
  // Electrical
  {
    section: 'Electrical',
    item_name: 'Wiring — False Ceiling, Kitchen Cabinets, TV, Pooja, Crockery, Vanity, Dressing, Chipping & Plastering, Lighting & Labour (LSM)',
    unit: 'lumpsum',
    default_rate: 85000,
    is_lumpsum: true,
    sort_order: 1,
    is_active: true
  }
];

async function runSync() {
  console.log('🚀 Updating Rate Card items in Supabase...');

  for (const item of UPDATED_RATE_CARD_ITEMS) {
    const { data: existing } = await supabaseAdmin
      .from('rate_card')
      .select('id, item_name')
      .eq('section', item.section);

    let match = existing?.find((e: any) => {
      const name = e.item_name.toLowerCase();
      const target = item.item_name.toLowerCase();
      return (
        (name.includes('granite') && target.includes('granite')) ||
        (name.includes('dado') && target.includes('dado')) ||
        (name.includes('labour') && target.includes('labour')) ||
        (name.includes('false ceiling') && target.includes('false ceiling')) ||
        (name.includes('wall paint') && target.includes('wall paint')) ||
        (name.includes('wiring') && target.includes('wiring'))
      );
    });

    if (match) {
      console.log(`Updating existing rate card item [${match.id}]: ${item.item_name}`);
      const { error: updateError } = await supabaseAdmin
        .from('rate_card')
        .update({
          item_name: item.item_name,
          unit: item.unit,
          default_rate: item.default_rate,
          is_lumpsum: item.is_lumpsum,
          sort_order: item.sort_order,
          is_active: true
        })
        .eq('id', match.id);
      if (updateError) console.error('Update error:', updateError);
    } else {
      console.log(`Inserting new rate card item: ${item.item_name}`);
      const { error: insertError } = await supabaseAdmin
        .from('rate_card')
        .insert(item);
      if (insertError) console.error('Insert error:', insertError);
    }
  }

  console.log('✅ Rate Card Sync Complete!');
}

runSync().catch(console.error);
