import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Validasi Header Authorization
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Cron Secret' });
  }

  try {
    // Menjalankan fungsi RPC Supabase yang dibuat di Fase 2
    const { error } = await supabase.rpc('check_and_expire_licenses');
    
    if (error) throw error;
    
    res.status(200).json({ message: 'Housekeeping executed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}