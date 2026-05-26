export default function handler(req, res) {
  // Mengembalikan waktu UTC server Vercel secara realtime
  res.status(200).json({ utc: new Date().toISOString() });
}