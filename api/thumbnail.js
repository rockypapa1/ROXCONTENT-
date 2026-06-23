// api/thumbnail.js
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.body;

    // GENERATE
    if (action === 'generate') {
        try {
            const { title, style, keywords } = req.body;
            const prompt = `Create an engaging YouTube thumbnail for: "${title}". Style: ${style || 'Dynamic'}. Trending keywords: ${keywords || 'viral'}. High contrast, bold, cinematic.`;
            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: prompt,
                n: 4,
                size: "1024x1024",
                quality: "standard",
            });
            const images = response.data.map(img => ({ url: img.url }));
            return res.status(200).json({ success: true, images });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // ANALYZE
    else if (action === 'analyze') {
        try {
            const { imageUrl } = req.body;
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: `Analyze this thumbnail for YouTube CTR. Give score (0-100), verdict, strengths, weaknesses, suggestions. Return ONLY JSON.` },
                        { type: "image_url", image_url: { url: imageUrl } }
                    ]
                }],
                max_tokens: 500,
                response_format: { type: "json_object" }
            });
            const analysis = JSON.parse(response.choices[0].message.content);
            return res.status(200).json({ success: true, analysis });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    else {
        return res.status(400).json({ error: 'Invalid action' });
    }
}
