-- PHASE 3: Deep purge of user-request junk
-- All "State Official" entries without the p- slug prefix are from the unvalidated user request pipeline

-- Step 1: Delete child records for junk "State Official" entries
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%');
DELETE FROM politicians WHERE office_held = 'State Official' AND slug NOT LIKE 'p-%';

-- Step 2: Delete foreign politicians (not US officials)
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%');
DELETE FROM politicians WHERE office_held LIKE '%Iran%' OR office_held LIKE '%Russia%' OR office_held LIKE '%Australia%' OR office_held LIKE '%China%' OR office_held LIKE '%Nigeria%' OR office_held LIKE '%Minister of Petroleum%';

-- Step 3: Delete garbage entries (empty/placeholder names, dots, organizations)
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3);
DELETE FROM politicians WHERE name = '...' OR name = '-' OR name LIKE 'China %' OR name LIKE 'Husband%' OR LENGTH(name) < 3;

-- Step 4: Delete non-US officials (Weather Service directors, campaign staffers, etc.)
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%');
DELETE FROM politicians WHERE office_held LIKE '%National Weather%' OR office_held LIKE '%Campaign%' OR office_held LIKE '%Narcotics%' OR office_held LIKE '%State Assembly%';
