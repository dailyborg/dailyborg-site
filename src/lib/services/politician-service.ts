// src/lib/services/politician-service.ts
// DB dependency removed from top-level to allow headless node testing of just math functions

// Strict Stance Taxonomy Values (for mathematical derivation)
export const STANCE_WEIGHTS = {
    "Strongly Support": 2,
    "Support": 1,
    "Neutral": 0,
    "Oppose": -1,
    "Strongly Oppose": -2
} as const;

export type StanceTaxonomy = keyof typeof STANCE_WEIGHTS;

export interface PositionEvent {
    id: string;
    topic: string;
    stance: StanceTaxonomy;
    statement_date: string;
    source_url: string;
    source_excerpt: string;
}

export interface ShiftEvent {
    topic: string;
    previous_stance: string;
    previous_date: string;
    new_stance: string;
    new_date: string;
    shift_type: "Contradicted" | "Evolved";
}

export class PoliticianService {

    /**
     * Sorts raw position statements, detects intensity changes (Evolutions) vs 
     * directional changes (Contradictions).
     */
    static calculateConsistency(positions: PositionEvent[]): {
        score: number | null;
        totalEligibleTopics: number;
        contradictions: number;
        shiftEvents: ShiftEvent[];
    } {
        const events: ShiftEvent[] = [];
        let contradictions = 0;
        let eligibleTopics = 0;

        // Group explicitly by topic
        const topicMap = new Map<string, PositionEvent[]>();
        for (const p of positions) {
            const list = topicMap.get(p.topic) || [];
            list.push(p);
            topicMap.set(p.topic, list);
        }

        // Evaluate each topic
        for (const [topic, topicPositions] of topicMap.entries()) {
            // Must have multiple statements to show a shift
            if (topicPositions.length < 2) continue;

            eligibleTopics++;

            // Sort chronologically ascending
            const chronological = topicPositions.sort(
                (a, b) => new Date(a.statement_date).getTime() - new Date(b.statement_date).getTime()
            );

            // Compare sequentially
            for (let i = 0; i < chronological.length - 1; i++) {
                const prev = chronological[i];
                const next = chronological[i + 1];

                const prevWeight = STANCE_WEIGHTS[prev.stance] ?? 0;
                const nextWeight = STANCE_WEIGHTS[next.stance] ?? 0;

                // If it remained identical, skip checking
                if (prevWeight === nextWeight) continue;

                const distance = Math.abs(prevWeight - nextWeight);

                // Definition: If it crosses 0, it's a directional shift. Or if distance >= 2.
                // E.g. Support (1) -> Oppose (-1) = Distance 2. Contradiction.
                // E.g. Support (1) -> Neutral (0) = Distance 1. Evolution.
                const isContradiction = distance >= 2 || (Math.sign(prevWeight) !== Math.sign(nextWeight) && prevWeight !== 0 && nextWeight !== 0);

                const shiftType = isContradiction ? "Contradicted" : "Evolved";
                if (isContradiction) contradictions++;

                events.push({
                    topic,
                    previous_stance: prev.stance,
                    previous_date: prev.statement_date,
                    new_stance: next.stance,
                    new_date: next.statement_date,
                    shift_type: shiftType
                });
            }
        }

        // Methodological Constraint: 
        // Need at least 2 topics with multiple points to provide a statistically fair score
        if (eligibleTopics < 2) {
            return {
                score: null,
                totalEligibleTopics: eligibleTopics,
                contradictions,
                shiftEvents: events.reverse() // Newest first
            };
        }

        // Formula Calculation
        const penaltyPerContradiction = 15;
        const totalPenalty = (contradictions * penaltyPerContradiction) / eligibleTopics;
        const score = Math.max(0, 100 - totalPenalty);

        return {
            score: Math.round(score),
            totalEligibleTopics: eligibleTopics,
            contradictions,
            shiftEvents: events.reverse()
        };
    }

    /**
     * Calculates the Promise Keeps Rate reliably
     */
    static calculatePromises(promises: any[]): {
        rate: number | null;
        totalTracked: number;
        breakdown: { fulfilled: number, broken: number, reversed: number, inProgress: number };
    } {
        const breakdown = { fulfilled: 0, broken: 0, reversed: 0, inProgress: 0 };
        for (const p of promises) {
            if (p.status === "Fulfilled") breakdown.fulfilled++;
            if (p.status === "Broken") breakdown.broken++;
            if (p.status === "Reversed") breakdown.reversed++;
            if (p.status === "In Progress") breakdown.inProgress++;
        }

        // Denominator excludes In Progress
        const denominator = breakdown.fulfilled + breakdown.broken + breakdown.reversed;

        if (denominator === 0) {
            return { rate: null, totalTracked: promises.length, breakdown };
        }

        const rate = (breakdown.fulfilled / denominator) * 100;
        return { rate: Math.round(rate), totalTracked: promises.length, breakdown };
    }

    /**
     * Primary batched entrypoint for the dynamic UI
     */
    static async getProfile(slug: string) {
        if (slug === 'sample-slug') {
            return {
                politician: {
                    id: 'pol_mock', slug: 'sample-slug', name: 'Eleanor Vance', office_held: 'U.S. Senate', party: 'Democrat', district_state: 'OH', time_in_office: '4 Years, 2 Months', country: 'US', region_level: 'Federal'
                },
                promises: [
                    { promise_text: 'Codify metadata guidelines into federal law', date_said: '2022-10-14', issue_area: 'Tech Policy', status: 'In Progress' },
                    { promise_text: 'Lower corporate tax rates for syndicates', date_said: '2023-01-11', issue_area: 'Economy', status: 'Broken' },
                    { promise_text: 'Increase funding for national algorithmic deployments', date_said: '2023-04-05', issue_area: 'Infrastructure', status: 'Fulfilled' }
                ],
                positions: [],
                methodology: { version_name: 'v1.4 - Baseline', description: 'Standard algorithmic ingestion weightings for positional contradiction detection.', formula: 'Score = MAX(0, 100 - ((Contradictions * 15) / Eligible Topics))' },
                derivedScores: {
                    promiseKeepsRate: 33,
                    promiseBreakdown: { fulfilled: 1, broken: 1, reversed: 0, inProgress: 1 },
                    consistencyScore: 85,
                    consistencyBreakdown: {
                        eligibleTopics: 2,
                        contradictions: 1,
                        shiftEvents: [
                            { topic: 'Digital Privacy Expansion', previous_stance: 'Support', previous_date: '2021-11-04', new_stance: 'Strongly Oppose', new_date: '2024-02-15', shift_type: 'Contradicted' },
                            { topic: 'Defense Spending Reduction', previous_stance: 'Neutral', previous_date: '2022-05-10', new_stance: 'Support', new_date: '2023-09-22', shift_type: 'Evolved' }
                        ] as ShiftEvent[]
                    }
                }
            };
        }

        // Dynamic import protects the pure math functions above from breaking in Node Test CLI
        const { getDbBinding } = await import("../db");
        const db = await getDbBinding();

        // Execute queries sequentially for local SQLite compatibility under OpenNext
        const politicianRes = await db.prepare(`SELECT * FROM politicians WHERE slug = ? AND country = 'US'`).bind(slug);
        const promisesRes = await db.prepare(`SELECT * FROM promises WHERE politician_id = (SELECT id FROM politicians WHERE slug = ? AND country = 'US') ORDER BY date_said DESC`).bind(slug);
        const positionsRes = await db.prepare(`SELECT * FROM positions WHERE politician_id = (SELECT id FROM politicians WHERE slug = ? AND country = 'US') ORDER BY topic ASC, statement_date DESC`).bind(slug);
        const methodologyRes = await db.prepare(`SELECT * FROM methodology_versions WHERE is_active = 1 LIMIT 1`);

        const politician = politicianRes?.results?.[0] || politicianRes?.[0]?.results?.[0]; // Handle varying return shapes between D1 / BetterSQLite
        if (!politician) return null;

        const promises = promisesRes?.results || promisesRes?.[0]?.results || [];
        const positions = (positionsRes?.results as PositionEvent[]) || (positionsRes?.[0]?.results as PositionEvent[]) || [];
        const activeMethodology = methodologyRes?.results?.[0] || methodologyRes?.[0]?.results?.[0] || null;

        // Fetch new Verification Engine items
        const rawClaimsRes = await db.prepare(`SELECT * FROM claims WHERE politician_id = ? ORDER BY date DESC LIMIT 20`).bind(politician.id);
        const rawClaims = rawClaimsRes?.results || rawClaimsRes?.[0]?.results || [];

        let evidenceMap: Record<string, any[]> = {};
        if (rawClaims.length > 0) {
            const claimIds = rawClaims.map((c: any) => `'${c.id}'`).join(',');
            const evidenceQuery = `SELECT * FROM evidence WHERE claim_id IN (${claimIds})`;
            const evRes = await db.prepare(evidenceQuery).bind().all();
            const allEvidence = evRes?.results || [];

            allEvidence.forEach((ev: any) => {
                if (!evidenceMap[ev.claim_id]) evidenceMap[ev.claim_id] = [];
                evidenceMap[ev.claim_id].push(ev);
            });
        }

        const stanceChangesRes = await db.prepare(`
           SELECT sc.*, 
                  oc.content as old_content, oc.date as old_date, oc.context as old_context,
                  nc.content as new_content, nc.date as new_date, nc.context as new_context
           FROM stance_changes sc
           JOIN claims oc ON sc.old_claim_id = oc.id
           JOIN claims nc ON sc.new_claim_id = nc.id
           WHERE sc.politician_id = ? 
           ORDER BY sc.created_at DESC LIMIT 10
        `).bind(politician.id);

        const rawStanceChanges = stanceChangesRes?.results || stanceChangesRes?.[0]?.results || [];

        const stanceChangesFormatted = rawStanceChanges.map((sc: any) => ({
            id: sc.id,
            topic: sc.topic,
            shift_description: sc.shift_description,
            dateOfChange: sc.new_date,
            old_claim: { content: sc.old_content, date: sc.old_date, context: sc.old_context },
            new_claim: { content: sc.new_content, date: sc.new_date, context: sc.new_context }
        }));

        const promiseMetrics = this.calculatePromises(promises);
        const consistencyMetrics = this.calculateConsistency(positions);

        return {
            politician,
            promises,
            positions,
            claims: rawClaims,
            evidenceMap,
            aiStanceChanges: stanceChangesFormatted,
            methodology: activeMethodology,
            derivedScores: {
                promiseKeepsRate: promiseMetrics.rate,
                promiseBreakdown: promiseMetrics.breakdown,
                consistencyScore: consistencyMetrics.score,
                consistencyBreakdown: {
                    eligibleTopics: consistencyMetrics.totalEligibleTopics,
                    contradictions: consistencyMetrics.contradictions,
                    shiftEvents: consistencyMetrics.shiftEvents
                }
            }
        };
    }
}
