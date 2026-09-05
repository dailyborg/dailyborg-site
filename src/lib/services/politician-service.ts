// src/lib/services/politician-service.ts
// Every read here is index backed (migration 0010) and cached at the edge (src/lib/cache.ts).
import { getDbBinding } from "../db";
import { cachedJson } from "../cache";

// Strict stance taxonomy values (for the consistency score)
export const STANCE_WEIGHTS = {
    "Strongly Support": 2,
    "Support": 1,
    "Neutral": 0,
    "Oppose": -1,
    "Strongly Oppose": -2,
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

export interface PoliticianCard {
    id: string;
    slug: string;
    name: string;
    office_held: string;
    party: string;
    district_state: string;
    state: string | null;
    region_level: string;
    candidate_status: string;
    photo_url: string | null;
    trustworthiness_score: number | null;
    popularity_score: number;
    promises_kept: number;
    promises_broken: number;
    promises_total: number;
}

export interface FactCheck {
    id: string;
    statement: string;
    rating: string;
    analysis_text: string | null;
    source_url: string | null;
    date: string;
}

export const DIRECTORY_COLUMNS =
    "id, slug, name, office_held, party, district_state, state, region_level, candidate_status, photo_url, trustworthiness_score, popularity_score, promises_kept, promises_broken, promises_total";

export const LEVELS = ["Federal", "State", "Local"] as const;
export type Level = (typeof LEVELS)[number];

export const US_STATE_CODES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
    "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
    "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC", "PR",
];

// How much each PolitiFact ruling pulls a trust score down. Mirrors workers/truth-engine.
const FALSENESS: Record<string, number> = { true: 0, mostly_true: 0.2, half_true: 0.5, mostly_false: 0.8, false: 1, pants_on_fire: 1 };
export const MIN_RULINGS_FOR_TRUST = 3;

function normalizeCard(p: any): PoliticianCard {
    return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        office_held: p.office_held || "Public Official",
        party: p.party || "Independent",
        district_state: p.district_state || "--",
        state: p.state || null,
        region_level: p.region_level || "Federal",
        candidate_status: p.candidate_status || "Active",
        photo_url: p.photo_url || null,
        trustworthiness_score: p.trustworthiness_score ?? null,
        popularity_score: p.popularity_score ?? 0,
        promises_kept: p.promises_kept ?? 0,
        promises_broken: p.promises_broken ?? 0,
        promises_total: p.promises_total ?? 0,
    };
}

export class PoliticianService {
    /** Sorts raw position statements and separates intensity changes (evolutions) from reversals (contradictions). */
    static calculateConsistency(positions: PositionEvent[]): { score: number | null; totalEligibleTopics: number; contradictions: number; shiftEvents: ShiftEvent[] } {
        const events: ShiftEvent[] = [];
        let contradictions = 0;
        let eligibleTopics = 0;

        const topicMap = new Map<string, PositionEvent[]>();
        for (const p of positions) {
            const list = topicMap.get(p.topic) || [];
            list.push(p);
            topicMap.set(p.topic, list);
        }

        for (const [topic, topicPositions] of topicMap.entries()) {
            if (topicPositions.length < 2) continue;
            eligibleTopics++;
            const chronological = topicPositions.sort((a, b) => new Date(a.statement_date).getTime() - new Date(b.statement_date).getTime());
            for (let i = 0; i < chronological.length - 1; i++) {
                const prev = chronological[i];
                const next = chronological[i + 1];
                const prevWeight = STANCE_WEIGHTS[prev.stance] ?? 0;
                const nextWeight = STANCE_WEIGHTS[next.stance] ?? 0;
                if (prevWeight === nextWeight) continue;
                const distance = Math.abs(prevWeight - nextWeight);
                const isContradiction = distance >= 2 || (Math.sign(prevWeight) !== Math.sign(nextWeight) && prevWeight !== 0 && nextWeight !== 0);
                if (isContradiction) contradictions++;
                events.push({ topic, previous_stance: prev.stance, previous_date: prev.statement_date, new_stance: next.stance, new_date: next.statement_date, shift_type: isContradiction ? "Contradicted" : "Evolved" });
            }
        }

        if (eligibleTopics < 2) {
            return { score: null, totalEligibleTopics: eligibleTopics, contradictions, shiftEvents: events.reverse() };
        }
        const totalPenalty = (contradictions * 15) / eligibleTopics;
        return { score: Math.round(Math.max(0, 100 - totalPenalty)), totalEligibleTopics: eligibleTopics, contradictions, shiftEvents: events.reverse() };
    }

    /** Promise keep rate; "In Progress" promises are excluded from the denominator. */
    static calculatePromises(promises: any[]): { rate: number | null; totalTracked: number; breakdown: { fulfilled: number; broken: number; reversed: number; inProgress: number } } {
        const breakdown = { fulfilled: 0, broken: 0, reversed: 0, inProgress: 0 };
        for (const p of promises) {
            if (p.status === "Fulfilled") breakdown.fulfilled++;
            if (p.status === "Broken") breakdown.broken++;
            if (p.status === "Reversed") breakdown.reversed++;
            if (p.status === "In Progress") breakdown.inProgress++;
        }
        const denominator = breakdown.fulfilled + breakdown.broken + breakdown.reversed;
        if (denominator === 0) return { rate: null, totalTracked: promises.length, breakdown };
        return { rate: Math.round((breakdown.fulfilled / denominator) * 100), totalTracked: promises.length, breakdown };
    }

    /** Trust score from published fact-check rulings. Null until there are at least MIN_RULINGS_FOR_TRUST rulings. */
    static calculateTrust(factChecks: FactCheck[]): { score: number | null; rulings: number; falseRulings: number; breakdown: Record<string, number> } {
        const breakdown: Record<string, number> = {};
        let sum = 0, counted = 0, falseRulings = 0;
        for (const fc of factChecks) {
            const w = FALSENESS[fc.rating];
            if (w === undefined) continue;
            counted++;
            sum += w;
            breakdown[fc.rating] = (breakdown[fc.rating] || 0) + 1;
            if (w >= 0.8) falseRulings++;
        }
        if (counted < MIN_RULINGS_FOR_TRUST) return { score: null, rulings: counted, falseRulings, breakdown };
        return { score: Math.round(100 - (sum / counted) * 100), rulings: counted, falseRulings, breakdown };
    }

    /**
     * Directory slice for the Borg Record page. Federal is the default view (about 540 rows).
     * State views require a state; without one we show a small national sample by popularity.
     */
    static async listDirectory(level: Level, state: string | null, includeFormer: boolean): Promise<PoliticianCard[]> {
        const key = `dir:${level}:${state || "all"}:${includeFormer ? 1 : 0}`;
        return cachedJson(key, 600, async () => {
            const db = await getDbBinding();
            const statusClause = includeFormer ? "" : " AND candidate_status <> 'Former'";
            let sql: string;
            const binds: any[] = [];
            if (level === "Federal") {
                sql = `SELECT ${DIRECTORY_COLUMNS} FROM politicians WHERE region_level = 'Federal'${statusClause} ORDER BY name ASC LIMIT 800`;
            } else if (state) {
                sql = `SELECT ${DIRECTORY_COLUMNS} FROM politicians WHERE state = ? AND region_level = ?${statusClause} ORDER BY name ASC LIMIT 600`;
                binds.push(state, level);
            } else {
                sql = `SELECT ${DIRECTORY_COLUMNS} FROM politicians WHERE region_level = ?${statusClause} ORDER BY popularity_score DESC, name ASC LIMIT 60`;
                binds.push(level);
            }
            try {
                const res = await db.prepare(sql).bind(...binds).all();
                return (res?.results || []).map(normalizeCard);
            } catch (e) {
                console.error("[politicians] directory query failed", e);
                return [];
            }
        });
    }

    /** Prefix search on the indexed name column, used by the directory search box and the subscribe page. */
    static async search(query: string): Promise<PoliticianCard[]> {
        const q = query.trim().replace(/[%_]/g, "").slice(0, 60);
        if (q.length < 2) return [];
        return cachedJson(`search:${q.toLowerCase()}`, 600, async () => {
            const db = await getDbBinding();
            try {
                // Two indexed prefix probes (first name, then anywhere) so "Sanders" and "Bernie" both work.
                const res = await db.prepare(
                    `SELECT ${DIRECTORY_COLUMNS} FROM politicians WHERE name LIKE ? OR name LIKE ? ORDER BY candidate_status ASC, popularity_score DESC, name ASC LIMIT 25`
                ).bind(`${q}%`, `% ${q}%`).all();
                return (res?.results || []).map(normalizeCard);
            } catch (e) {
                console.error("[politicians] search failed", e);
                return [];
            }
        });
    }

    /** Officials worth featuring on the home page and the compare picker: active, federal, most viewed. */
    static async featured(limit = 24): Promise<PoliticianCard[]> {
        return cachedJson(`featured:${limit}`, 900, async () => {
            const db = await getDbBinding();
            try {
                const res = await db.prepare(
                    `SELECT ${DIRECTORY_COLUMNS} FROM politicians WHERE region_level = 'Federal' AND candidate_status = 'Active' ORDER BY popularity_score DESC, name ASC LIMIT ?`
                ).bind(limit).all();
                return (res?.results || []).map(normalizeCard);
            } catch { return []; }
        });
    }

    /** Latest published rulings across all officials, for the home page sidebar. */
    static async latestRulings(limit = 4): Promise<Array<FactCheck & { politician_name: string; politician_slug: string }>> {
        return cachedJson(`rulings:${limit}`, 600, async () => {
            const db = await getDbBinding();
            try {
                const res = await db.prepare(
                    `SELECT fc.id, fc.statement, fc.rating, fc.analysis_text, fc.source_url, fc.date, p.name AS politician_name, p.slug AS politician_slug
                     FROM fact_checks fc JOIN politicians p ON p.slug = fc.politician_slug
                     ORDER BY fc.created_at DESC LIMIT ?`
                ).bind(limit).all();
                return (res?.results || []) as any[];
            } catch { return []; }
        });
    }

    /** Full profile for /borg-record/politicians/[slug]. Cached for five minutes per official. */
    static async getProfile(slug: string) {
        const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120);
        if (!safeSlug) return null;
        return cachedJson(`profile:${safeSlug}`, 300, async () => {
            const db = await getDbBinding();
            const politician = await db.prepare("SELECT * FROM politicians WHERE slug = ?").bind(safeSlug).first();
            if (!politician) return null;
            const id = (politician as any).id as string;

            const [promisesRes, positionsRes, claimsRes, stanceRes, trustHistRes, votesRes, fcRes, methodologyRes] = await Promise.all([
                db.prepare("SELECT * FROM promises WHERE politician_id = ? ORDER BY date_said DESC LIMIT 50").bind(id).all(),
                db.prepare("SELECT * FROM positions WHERE politician_id = ? ORDER BY topic ASC, statement_date DESC LIMIT 100").bind(id).all(),
                db.prepare("SELECT * FROM claims WHERE politician_id = ? ORDER BY date DESC LIMIT 20").bind(id).all(),
                db.prepare(`SELECT sc.*, oc.content AS old_content, oc.date AS old_date, oc.context AS old_context,
                                   nc.content AS new_content, nc.date AS new_date, nc.context AS new_context
                            FROM stance_changes sc JOIN claims oc ON sc.old_claim_id = oc.id JOIN claims nc ON sc.new_claim_id = nc.id
                            WHERE sc.politician_id = ? ORDER BY sc.created_at DESC LIMIT 10`).bind(id).all(),
                db.prepare("SELECT score, promises_kept, promises_broken, scored_at FROM trustworthiness_history WHERE politician_id = ? ORDER BY scored_at ASC LIMIT 30").bind(id).all(),
                db.prepare(`SELECT v.id, v.title, v.vote_date, v.url, pv.position, pv.rationale FROM votes v JOIN politician_votes pv ON v.id = pv.vote_id
                            WHERE pv.politician_id = ? ORDER BY v.vote_date DESC LIMIT 10`).bind(id).all(),
                db.prepare("SELECT id, statement, rating, analysis_text, source_url, date FROM fact_checks WHERE politician_slug = ? ORDER BY date DESC LIMIT 25").bind(safeSlug).all(),
                db.prepare("SELECT version_name, description, formula FROM methodology_versions ORDER BY created_at DESC LIMIT 1").all(),
            ]);

            const promises = (promisesRes?.results || []) as any[];
            const positions = (positionsRes?.results || []) as PositionEvent[];
            const rawClaims = (claimsRes?.results || []) as any[];
            const factChecks = (fcRes?.results || []) as FactCheck[];

            let evidenceMap: Record<string, any[]> = {};
            if (rawClaims.length > 0) {
                const placeholders = rawClaims.map(() => "?").join(",");
                const evRes = await db.prepare(`SELECT * FROM evidence WHERE claim_id IN (${placeholders})`).bind(...rawClaims.map(c => c.id)).all();
                for (const ev of (evRes?.results || []) as any[]) {
                    (evidenceMap[ev.claim_id] ||= []).push(ev);
                }
            }

            const aiStanceChanges = ((stanceRes?.results || []) as any[]).map(sc => ({
                id: sc.id, topic: sc.topic, shift_description: sc.shift_description, dateOfChange: sc.new_date,
                old_claim: { content: sc.old_content, date: sc.old_date, context: sc.old_context },
                new_claim: { content: sc.new_content, date: sc.new_date, context: sc.new_context },
            }));

            const promiseMetrics = this.calculatePromises(promises);
            const consistencyMetrics = this.calculateConsistency(positions);
            const trust = this.calculateTrust(factChecks);

            return {
                politician: politician as any,
                promises,
                positions,
                claims: rawClaims,
                evidenceMap,
                aiStanceChanges,
                trustHistory: (trustHistRes?.results || []) as any[],
                recentVotes: (votesRes?.results || []) as any[],
                factChecks,
                methodology: (methodologyRes?.results?.[0] as any) || null,
                derivedScores: {
                    trustScore: (politician as any).trustworthiness_score ?? trust.score,
                    trustRulings: trust.rulings,
                    trustFalseRulings: trust.falseRulings,
                    trustBreakdown: trust.breakdown,
                    promiseKeepsRate: promiseMetrics.rate,
                    promiseBreakdown: promiseMetrics.breakdown,
                    consistencyScore: consistencyMetrics.score,
                    consistencyBreakdown: {
                        eligibleTopics: consistencyMetrics.totalEligibleTopics,
                        contradictions: consistencyMetrics.contradictions,
                        shiftEvents: consistencyMetrics.shiftEvents,
                    },
                },
            };
        });
    }
}
