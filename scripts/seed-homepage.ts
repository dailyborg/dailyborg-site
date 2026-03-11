import { getD1Database } from '../src/lib/db';

async function seed() {
    const db = await getD1Database();

    if (!db) {
        console.log("No DB found");
        return;
    }

    try {
        await db.prepare(`
        INSERT INTO articles (id, title, desk, read_time, excerpt, content_html, slug, article_type, hero_image_url, approval_status, publish_date)
        VALUES (
          'hero123',
          'Audit Reveals $4.2B in Misallocated Infrastructure Funds Across Three States',
          'Investigation',
          6,
          'A comprehensive review of the 2024 Interstate Commerce Grant allocations has uncovered severe discrepancies. Official records cross-referenced with vendor payment registries indicate that billions have been diverted from bridge repair projects into untracked municipal discretionary funds.',
          '<p>Full HTML context.</p>',
          'audit-reveals-4-2b',
          'breaking',
          null,
          'approved',
          datetime('now')
        )
      `).bind().run();

        await db.prepare(`
        INSERT INTO articles (id, title, desk, read_time, excerpt, content_html, slug, article_type, hero_image_url, approval_status, publish_date)
        VALUES (
          'sub123',
          'Senate Appropriations Committee Clashes Over Defense Budget Allocations',
          'Politics',
          4,
          'Hours of testimony revealed deep partisan divides on modernization priorities, with specific focus on maritime autonomous systems...',
          '<p>Senate text.</p>',
          'senate-budget-clash',
          'standard',
          null,
          'approved',
          datetime('now', '-2 hours')
        )
      `).bind().run();

        console.log("Seeded database with approved articles.");
    } catch (e: any) {
        console.log("Error or already seeded", e.message);
    }
}
seed();
