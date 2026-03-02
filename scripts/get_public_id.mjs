import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getPublicId() {
  const { data, error } = await supabase
    .from('anchors')
    .select('public_id')
    .not('public_id', 'is', null)
    .limit(1);

  if (error) {
    console.error('Error fetching public_id:', error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log(data[0].public_id);
  } else {
    console.log('No public_id found');
  }
}

getPublicId();
