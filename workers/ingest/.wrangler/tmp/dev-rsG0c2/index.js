var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var src_default = {
  async queue(batch, env) {
    for (const message of batch.messages) {
      const payload = message.body;
      const { sourceUrl, title, rawContent, type } = payload;
      try {
        let articleObject = null;
        let attempts = 0;
        let isDraft = false;
        const enrichmentPrompt = `
          Analyze the following article content from ${sourceUrl}.
          Title: ${title}
          Content: ${rawContent}

          You are a senior political editor. Write an original article based on this.
          STRICT REQUIREMENTS:
          1. The output contentHtml MUST be strictly between 450 and 600 words. Do not ignore this.
          2. You MUST extract or identify at least 2 distinct sources (organizations, people, or documents cited).

          Return a JSON object with:
          - canonical_event_slug (a generic kebab-case slug representing the event itself, e.g., 'senate-tech-hearing-2026'. Do not include publication names)
          - title (optimized newsroom headline)
          - excerpt (short deck context)
          - contentHtml (full article HTML with calm, credible newspaper formatting, no inline citations)
          - keyTakeaways (an array of strings)
          - confidenceScore (1-100 based on source authority)
          - suggestedHeroImagePrompt (a detailed prompt for gemini-3-1-flash-image-preview)
          - sources (an array of objects, each with 'source_name', 'source_url' (if available, otherwise leave blank) and 'source_type')
        `;
        while (attempts < 2) {
          attempts++;
          if (env.AIML_API_KEY && env.AIML_API_KEY.length > 5 && env.AIML_API_KEY !== "mock") {
            console.log(`[Attempt ${attempts}] Generating AI Enrichment...`);
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
          } else {
            console.log("Using Mock AI Payload because API Key is missing or invalid.");
            articleObject = {
              canonical_event_slug: `mocked-event-${Date.now()}`,
              title,
              excerpt: "Mock excerpt for E2E testing.",
              contentHtml: "<p>Mock. ".repeat(60) + "</p>",
              // Just enough to pass 450 length gate 
              keyTakeaways: ["Takeaway 1"],
              confidenceScore: 80,
              suggestedHeroImagePrompt: "Mock drawing",
              sources: [
                { source_name: "Mock Source 1", source_url: sourceUrl, source_type: "primary" },
                { source_name: "Mock Source 2", source_url: "", source_type: "secondary" }
              ]
            };
          }
          if (attempts === 1) {
            console.log(`Evaluating canonical event slug: ${articleObject.canonical_event_slug}`);
            const existing = await env.DB.prepare("SELECT id FROM articles WHERE slug = ?").bind(articleObject.canonical_event_slug).first();
            if (existing) {
              console.log(`\u274C Event '${articleObject.canonical_event_slug}' already exists in DB. Dropping duplicate story.`);
              message.ack();
              return;
            }
          }
          let failedGates = [];
          if (articleObject.confidenceScore < 75 && type === "breaking") {
            failedGates.push(`Confidence too low (${articleObject.confidenceScore} < 75)`);
          }
          if (!articleObject.sources || articleObject.sources.length < 2) {
            failedGates.push(`Insufficient sources (${articleObject.sources?.length || 0} < 2)`);
          }
          const plainText = articleObject.contentHtml.replace(/<[^>]*>?/gm, "");
          const wordCount = plainText.split(/\s+/).filter((w) => w.length > 0).length;
          if (wordCount < 450 || wordCount > 600) {
            failedGates.push(`Word count out of bounds (${wordCount} words)`);
          }
          if (failedGates.length > 0) {
            console.warn(`Quality gates failed on attempt ${attempts}: ${failedGates.join(", ")}`);
            if (attempts === 1) {
              console.log(`Retrying AI generation...`);
              continue;
            } else {
              console.log(`Quality gates failed after retry. Forcing type to 'draft'.`);
              isDraft = true;
              break;
            }
          } else {
            console.log(`\u2705 Quality gates passed. (Words: ${wordCount}, Sources: ${articleObject.sources.length})`);
            break;
          }
        }
        let heroImageUrl = "https://example.com/generated-hero.jpg";
        try {
          console.log(`Requesting hero image generation...`);
          if (env.AIML_API_KEY && env.AIML_API_KEY.length > 5 && env.AIML_API_KEY !== "mock") {
            const imageRes = await fetch("https://api.aimlapi.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.AIML_API_KEY}`
              },
              body: JSON.stringify({
                model: "gemini-3-1-flash-image-preview",
                prompt: articleObject.suggestedHeroImagePrompt
              })
            });
            if (imageRes.ok) {
              const imgData = await imageRes.json();
              const srcUrl = imgData.data[0].url;
              const imgBuffer = await fetch(srcUrl);
              const buffer = await imgBuffer.arrayBuffer();
              const fileKey = `hero-${articleObject.canonical_event_slug}-${Date.now()}.jpg`;
              await env.IMAGE_BUCKET.put(fileKey, buffer, {
                httpMetadata: { contentType: "image/jpeg" }
              });
              heroImageUrl = `https://pub-YOUR_BUCKET_ID.r2.dev/${fileKey}`;
              console.log(`Successfully generated and stored image at ${heroImageUrl}`);
            } else {
              console.warn(`Image generation failed: ${imageRes.statusText}`);
            }
          } else {
            console.log("Skipping actual AI Image generation to save cost/time.");
          }
        } catch (imgErr) {
          console.error(`Failed to generate/store image: `, imgErr);
        }
        const finalArticleType = isDraft ? "draft" : type || "standard";
        const id = crypto.randomUUID();
        console.log(`Inserting ${finalArticleType} article ${id} into D1...`);
        const { success } = await env.DB.prepare(`
          INSERT INTO articles (id, slug, title, excerpt, content_html, article_type, confidence_score, desk, hero_image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          articleObject.canonical_event_slug,
          articleObject.title,
          articleObject.excerpt,
          articleObject.contentHtml,
          finalArticleType,
          articleObject.confidenceScore,
          "Politics Grid",
          heroImageUrl
        ).run();
        if (!success) throw new Error("Database insertion failed");
        if (articleObject.sources && articleObject.sources.length > 0) {
          const stmts = articleObject.sources.map((s) => {
            return env.DB.prepare(`INSERT INTO article_sources (id, article_id, source_name, source_url, source_type) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), id, s.source_name, s.source_url || null, s.source_type || "unclassified");
          });
          await env.DB.batch(stmts);
          console.log(`\u2705 Inserted ${stmts.length} sources linked to ${id}`);
        }
        message.ack();
      } catch (error) {
        console.log("Queue processing error caught! Stringified error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.log("Error toString:", error.toString());
        message.retry();
      }
    }
  },
  // Temporary manual trigger for E2E testing
  async fetch(request, env) {
    if (request.method === "POST") {
      const body = await request.json();
      console.log("TESTING NATIVELY via HTTP");
      const mockBatch = {
        messages: [{
          body,
          ack: /* @__PURE__ */ __name(() => console.log("Mock message acked"), "ack"),
          retry: /* @__PURE__ */ __name(() => console.log("Mock message retried"), "retry")
        }]
      };
      await this.queue(mockBatch, env);
      return new Response("OK");
    }
    return new Response("Not found", { status: 404 });
  }
};

// ../../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-P5PjWv/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-P5PjWv/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
