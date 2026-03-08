// src/index.ts
var index_default = {
  async queue(batch, env) {
    for (const message of batch.messages) {
      const payload = message.body;
      const { sourceUrl, title, rawContent, type } = payload;
      try {
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
        const existing = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(slug).first();
        if (existing) {
          console.log(`Article with slug ${slug} already exists. Skipping.`);
          message.ack();
          continue;
        }
        let articleObject = null;
        let attempts = 0;
        let isDraft = false;
        const enrichmentPrompt = `
          Analyze the following article content from ${sourceUrl}.
          Title: ${title}
          Content: ${rawContent}

          Return a JSON object with:
          - title (optimized newsroom headline)
          - excerpt (short deck context)
          - contentHtml (full article HTML with calm, credible newspaper formatting, no inline citations)
          - keyTakeaways (an array of strings)
          - confidenceScore (1-100 based on source authority)
          - suggestedHeroImagePrompt (a detailed prompt for gemini-3-1-flash-image-preview)
        `;
        while (attempts < 2) {
          attempts++;
          const aiResponse = await fetch("https://api.aimlapi.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.AIML_API_KEY}`
            },
            body: JSON.stringify({
              model: "gemini-3-flash-preview",
              messages: [{ role: "user", content: enrichmentPrompt }],
              response_format: { type: "json_object" }
            })
          });
          if (!aiResponse.ok) {
            throw new Error(`AI Enrichment failed: ${aiResponse.statusText}`);
          }
          const aiData = await aiResponse.json();
          articleObject = JSON.parse(aiData.choices[0].message.content);
          if (articleObject.confidenceScore < 75 && type === "breaking") {
            if (attempts === 1) {
              console.log(`Confidence score ${articleObject.confidenceScore} is below 75. Retrying...`);
              continue;
            } else {
              console.log(`Confidence score ${articleObject.confidenceScore} is still below 75 after retry. Drafting.`);
              isDraft = true;
              break;
            }
          } else {
            break;
          }
        }
        const heroImageUrl = "https://example.com/generated-hero.jpg";
        const finalArticleType = isDraft ? "draft" : type || "standard";
        const id = crypto.randomUUID();
        const { success } = await env.DB.prepare(`
          INSERT INTO articles (id, slug, title, excerpt, content_html, article_type, confidence_score, desk, hero_image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          slug,
          articleObject.title,
          articleObject.excerpt,
          articleObject.contentHtml,
          finalArticleType,
          articleObject.confidenceScore,
          "Politics Grid",
          // derived from clustering/metadata
          heroImageUrl
        ).run();
        if (!success) throw new Error("Database insertion failed");
        message.ack();
      } catch (error) {
        console.error(error);
        message.retry();
      }
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
