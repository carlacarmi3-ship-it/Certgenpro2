import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const { license_key, device_id } = req.body;

  if (!license_key || !device_id) {
    return res.status(400).json({ valid: false, reason: 'MISSING_PARAMETERS' });
  }

  // 1. Cek Lisensi ke Supabase
  const { data: license, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('license_key', license_key)
    .single();

  // Jika lisensi tidak ditemukan
  if (error || !license) {
    return res.status(404).json({ valid: false, reason: 'INVALID_KEY' });
  }

  // Jika statusnya sudah dicabut (revoked) atau expired di database
  if (license.status === 'revoked' || license.status === 'expired') {
    return res.status(403).json({ valid: false, reason: license.status.toUpperCase() });
  }

  // Validasi lapis dua: cek waktu expired_at aktual jika Cron Job terlambat berjalan
  if (license.expired_at && new Date(license.expired_at) < new Date()) {
    return res.status(403).json({ valid: false, reason: 'EXPIRED' });
  }

  // 2. Logika Binding Perangkat
  if (license.device_id === null) {
    // Binding pertama kali
    const { error: updateError } = await supabase
      .from('licenses')
      .update({ 
        device_id: device_id,
        activated_at: new Date().toISOString()
      })
      .eq('license_key', license_key);

    if (updateError) {
      return res.status(500).json({ valid: false, reason: 'DATABASE_ERROR' });
    }

    // Catat Event
    await supabase.from('license_events').insert([{
      license_key, 
      event_type: 'activation', 
      device_id, 
      note: 'First time binding'
    }]);

  } else if (license.device_id !== device_id) {
    // Lisensi sudah terikat dengan device_id lain (Anti-Pindah PC)
    await supabase.from('license_events').insert([{
      license_key, 
      event_type: 'failed_activation', 
      device_id, 
      note: 'Hardware ID mismatch attempt'
    }]);
    
    return res.status(403).json({ valid: false, reason: 'DEVICE_MISMATCH' });
  }

  // 3. Jika semua lulus, kembalikan valid: true
  return res.status(200).json({
    valid: true,
    expired_at: license.expired_at,
    package_type: license.package_type
  });
}