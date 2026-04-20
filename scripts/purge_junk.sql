-- Step 1: Identify junk politician IDs
-- Junk criteria: office_held is None/N/A/Unknown/empty, or name is clearly fake
-- Store in a temp approach using subquery

-- First, delete from all child FK tables for junk politicians
DELETE FROM politician_committees WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

DELETE FROM politician_votes WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

DELETE FROM statements WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

DELETE FROM positions WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

DELETE FROM promises WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

DELETE FROM claims WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

DELETE FROM stance_changes WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

DELETE FROM trustworthiness_history WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

DELETE FROM subscriber_politicians WHERE politician_id IN (
    SELECT id FROM politicians WHERE 
        office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
        OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
        OR name IS NULL
        OR LENGTH(name) < 3
);

-- Step 2: Now delete the junk politicians themselves
DELETE FROM politicians WHERE 
    office_held IN ('None', 'none', 'N/A', 'Unknown', '') 
    OR name IN ('', 'First Last', 'Unknown Collector', 'Officer (unnamed)', 'Eleanor Vance', 'R. Mutt', 'Arielle Konig')
    OR name IS NULL
    OR LENGTH(name) < 3;
