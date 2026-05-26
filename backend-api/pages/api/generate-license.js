import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper untuk generate kode APP-XXXX-XXXX
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'APP-';
  for (let i = 0; i < 4; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  key += '-';
  for (let i = 0; i < 4; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { admin_secret, buyer_email, package_type } = req.body;

  // Validasi Admin
  if (admin_secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Admin Secret' });
  }

  // Hitung expired_at berdasarkan package_type
  let expired_at = null;
  const now = new Date();
  
  switch (package_type) {
    case 'daily':
      expired_at = new Date(now.setDate(now.getDate() + 1));
      break;
    case 'monthly':
      expired_at = new Date(now.setDate(now.getDate() + 30));
      break;
    case 'yearly':
      expired_at = new Date(now.setDate(now.getDate() + 365));
      break;
    case 'lifetime':
      expired_at = null; // Lifetime tidak memiliki masa kadaluarsa
      break;
    default:
      return res.status(400).json({ error: 'Invalid package_type. Use daily, monthly, yearly, or lifetime.' });
  }

  const license_key = generateLicenseKey();

  // Insert ke database
  const { data, error } = await supabase
    .from('licenses')
    .insert([{
      license_key,
      buyer_email,
      package_type,
      expired_at: expired_at ? expired_at.toISOString() : null
    }])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ 
    message: 'License generated successfully',
    license_key: data.license_key, 
    package_type: data.package_type, 
    expired_at: data.expired_at 
  });
}