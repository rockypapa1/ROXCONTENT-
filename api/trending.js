// api/trending.js
const API_KEY = process.env.YOUTUBE_API_KEY; // 🔥 Ye Vercel Env se aayega
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

let cache = {};
let cacheTime = 0;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const regionCode = req.query.region || 'IN';
    const categoryId = req.query.category || '0';
    const analyze = req.query.analyze === 'true';

    const cacheKey = `${regionCode}_${categoryId}`;
    const now = Date.now();
    if (cache[cacheKey] && (now - cacheTime < 5 * 60 * 1000)) {
        return res.status(200).json(cache[cacheKey]);
    }

    try {
        const url = `${BASE_URL}/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${regionCode}&videoCategoryId=${categoryId}&maxResults=50&key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.items) return res.status(500).json({ error: 'Failed to fetch' });

        const nowTime = new Date().getTime();
        const processed = data.items.map(video => {
            const published = new Date(video.snippet.publishedAt).getTime();
            const hoursSince = Math.max(1, (nowTime - published) / (1000 * 60 * 60));
            const views = parseInt(video.statistics.viewCount || 0);
            const likes = parseInt(video.statistics.likeCount || 0);
            const viewVelocity = views / hoursSince;
            const likeRatio = likes / (views || 1);
            const viralScore = viewVelocity * (0.5 + (likeRatio * 10));

            return {
                id: video.id,
                title: video.snippet.title,
                channelTitle: video.snippet.channelTitle,
                thumbnail: video.snippet.thumbnails.medium.url,
                views, likes,
                comments: parseInt(video.statistics.commentCount || 0),
                viewVelocity: Math.round(viewVelocity),
                viralScore: Math.round(viralScore),
                badge: viralScore > 1000000 ? '🔥🔥🔥 VIRAL' : 
                       viralScore > 500000 ? '🔥🔥 TRENDING' : 
                       viralScore > 100000 ? '🔥 HOT' : '⬆️ RISING'
            };
        });
        processed.sort((a, b) => b.viralScore - a.viralScore);

        // Analyze Keywords & Hashtags
        let analysis = null;
        if (analyze) {
            const keywordMap = new Map(); const hashtagMap = new Map();
            processed.forEach(v => {
                const title = v.title.toLowerCase();
                const score = v.viralScore;
                (title.match(/#\w+/g) || []).forEach(tag => {
                    const val = hashtagMap.get(tag) || { count: 0, totalScore: 0 };
                    val.count += 1; val.totalScore += score;
                    hashtagMap.set(tag, val);
                });
                const words = title.replace(/[^a-zA-Z0-9# ]/g, '').split(/\s+/);
                const stopwords = ['the','a','an','for','and','nor','but','or','yet','so','of','to','in','on','at','with','without','by','for','from','up','down','off','over','under'];
                words.forEach(w => {
                    if (w.length > 2 && !stopwords.includes(w) && !w.startsWith('#')) {
                        const val = keywordMap.get(w) || { count: 0, totalScore: 0 };
                        val.count += 1; val.totalScore += score;
                        keywordMap.set(w, val);
                    }
                });
            });
            const sortFn = (a, b) => (b.totalScore / b.count) - (a.totalScore / a.count);
            const keywords = Array.from(keywordMap.entries()).map(([w, d]) => ({ word: w, count: d.count, avgScore: Math.round(d.totalScore/d.count) })).sort(sortFn).slice(0, 15);
            const hashtags = Array.from(hashtagMap.entries()).map(([t, d]) => ({ tag: t, count: d.count, avgScore: Math.round(d.totalScore/d.count) })).sort(sortFn).slice(0, 10);
            analysis = { keywords, hashtags };
        }

        const result = { region: regionCode, category: categoryId, updatedAt: new Date().toISOString(), videos: processed, analysis };
        cache[cacheKey] = result;
        cacheTime = now;
        res.status(200).json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}