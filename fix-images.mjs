import { execSync } from "child_process";

const UNSPLASH_KEY = "Zwv0Ev9l0DwdO-mYzIms5mE_CQTuscPPClrSRxynjk8";
const DB_NAME = "dailyborg-db"; // Confirming this from rules.md

// 1. Fetch all articles stuck with the cloned image
console.log("Fetching cloned articles from D1...");
const selectCommand = `npx wrangler d1 execute ${DB_NAME} --remote --json --command "SELECT id, title FROM articles WHERE hero_image_url LIKE '%photo-1529107386315-e1a2ed48a620%'"`;

let stdout;
try {
    stdout = execSync(selectCommand, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
} catch (e) {
    console.error("Failed to query D1 database.");
    process.exit(1);
}

// Parse output (Wrangler returns an array of objects)
let articles = [];
try {
    // Wrangler sometimes logs non-json text before the JSON array. Find the first '['.
    const jsonStart = stdout.indexOf('[');
    if (jsonStart !== -1) {
        articles = JSON.parse(stdout.substring(jsonStart));
    }
} catch (e) {
    console.error("Failed to parse D1 output.", stdout);
    process.exit(1);
}

if (!articles || articles.length === 0 || !articles[0]?.results) {
    console.log("No articles found with the cloned image! Everything is already clean.");
    process.exit(0);
}

const rows = articles[0].results;
console.log(`Found ${rows.length} articles to fix.`);

// Stop words for keyword extraction
const stopWords = new Set(['the','a','an','of','in','on','for','to','and','is','are','as','at','by','its','how','why','what','with','from','has','have','that','this','into','over','after','new', 'report', 'report:']);

async function fixArticles() {
    for (const article of rows) {
        try {
            console.log(`Processing: "${article.title}"`);
            
            // Generate clean keywords from title
            const keywords = article.title
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
                .slice(0, 5)
                .join(' ');

            let newImageUrl = ""; // Default to empty string so Frontend Fallback matrix takes over if Unsplash fails.

            if (keywords.length > 0) {
                // Fetch from Unsplash
                const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&orientation=landscape&per_page=1`, {
                    headers: { 'Authorization': `Client-ID ${UNSPLASH_KEY}` }
                });

                if (unsplashRes.ok) {
                    const data = await unsplashRes.json();
                    if (data.results && data.results.length > 0) {
                        newImageUrl = data.results[0].urls.regular;
                        console.log(` -> Found Unsplash image: ${newImageUrl}`);
                    } else {
                         console.log(` -> No Unsplash result for "${keywords}", using dynamic fallback grid.`);
                    }
                } else {
                     console.log(` -> Unsplash API error ${unsplashRes.status}, using dynamic fallback grid.`);
                }
            } else {
                console.log(` -> Not enough keywords, using dynamic fallback grid.`);
            }

            // Execute the update
            const updateResult = execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command "UPDATE articles SET hero_image_url = '${newImageUrl}' WHERE id = '${article.id}'"`, { encoding: 'utf-8', stdio: 'pipe' });
            console.log(` -> Updated Database Successfully.\n`);
            
            // Sleep to respect Unsplash rate limits (50 per hour)
            await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
            console.error(` -> Failed to process article ID ${article.id}:`, err?.message);
        }
    }
    console.log("Finished all updates!");
}

fixArticles();
