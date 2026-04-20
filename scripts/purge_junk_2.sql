-- Purge foreign politicians (not US officials)
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%');
DELETE FROM politicians WHERE office_held LIKE '%Israel%' OR office_held LIKE '%Algeria%' OR office_held LIKE '%Pope%' OR office_held LIKE '%Baylor%' OR office_held LIKE '%Water District%';

-- Purge known non-politicians by name (sports, crypto, media figures inserted by user requests)
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan'));
DELETE FROM politicians WHERE name IN ('Taylor Swift', 'Satoshi Nakamoto', 'Adam Schefter', 'Hassan Diab', 'Anthony Collins', 'Farrah Khan');

-- Clear ALL AI-generated base64 photo URLs (these are the cartoon images)
UPDATE politicians SET photo_url = NULL WHERE photo_url LIKE 'data:image%';
