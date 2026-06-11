import { Router } from 'express';
import multer from 'multer';

const router = Router();
// Use memory storage — file is only read and forwarded to Gemini, never persisted to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PROMPT = `You are an accounting assistant. Analyse this invoice/receipt and extract:
1. Vendor/supplier name
2. Invoice number (if present)
3. Invoice date
4. Total amount (numbers only, no currency symbol)
5. Suggested expense category from this list: Repair & Maintenance | Assessment | Quit Rent | Insurance | Management Fee | Utilities | Professional Fee | Other
6. Brief description of the expense

Return ONLY a JSON object with no markdown, no explanation:
{
  "vendor_name": "",
  "invoice_number": "",
  "expense_date": "YYYY-MM-DD",
  "amount": 0.00,
  "category": "",
  "description": ""
}`;

router.post('/', upload.single('invoice'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const mimeType = req.file.mimetype;

  try {
    const base64Data = req.file.buffer.toString('base64');

    // Gemini 1.5 Flash supports PDF, JPEG, PNG natively — no conversion needed
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const effectiveMime = supportedTypes.includes(mimeType) ? mimeType : 'application/pdf';

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: effectiveMime, data: base64Data } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini error:', err);
      return res.status(502).json({ error: 'AI analysis failed', detail: err });
    }

    const geminiJson = await geminiRes.json() as any;
    console.log('Gemini full response:', JSON.stringify(geminiJson).slice(0, 1000));
    const parts = geminiJson.candidates?.[0]?.content?.parts ?? [];
    // 2.5 Pro returns a thinking part (thought:true) then the actual text part — find the real one
    const textPart = parts.find((p: any) => !p.thought) ?? parts[0];
    const rawText = textPart?.text ?? '';
    console.log('Gemini parts count:', parts.length, '| raw text length:', rawText.length);

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'Could not parse AI response', raw: rawText });

    const extracted = JSON.parse(jsonMatch[0]);
    res.json(extracted);
  } catch (err) {
    console.error('Invoice analysis error:', err);
    res.status(500).json({ error: 'Invoice analysis failed', detail: String(err) });
  }
});

export default router;
