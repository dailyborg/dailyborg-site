-- PHASE 4: Mark former officials and clean remainders

-- Step 1: Delete remaining foreign politicians
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky');
DELETE FROM politicians WHERE office_held LIKE '%Philippines%' OR office_held LIKE '%Kenya%' OR office_held LIKE '%Ukraine%' OR name = 'Trump' OR name = 'Uhuru Kenyan Government' OR name = 'Rodrigo Duterte' OR name = 'Volodymyr Oleksandrovych Zelensky';

-- Step 2: Remove duplicate Biden (keep "Joe Biden", remove "Joseph Robinette Biden Jr.")
DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE name = 'Joseph Robinette Biden Jr.');
DELETE FROM politicians WHERE name = 'Joseph Robinette Biden Jr.';

-- Step 3: Mark ALL past presidents/VPs as 'Former'
UPDATE politicians SET candidate_status = 'Former' WHERE name = 'Barack Obama';
UPDATE politicians SET candidate_status = 'Former' WHERE name = 'Jimmy Carter';
UPDATE politicians SET candidate_status = 'Former' WHERE name = 'Charles Curtis';

-- Dianne Feinstein passed away in 2023
UPDATE politicians SET candidate_status = 'Former' WHERE name = 'Dianne Feinstein';

-- Donald Trump is a former president (not currently in congress)
UPDATE politicians SET candidate_status = 'Former', office_held = '45th President of the United States' WHERE name = 'Donald Trump';

-- Joe Biden is a former president as of Jan 2025
UPDATE politicians SET candidate_status = 'Former', office_held = '46th President of the United States' WHERE name = 'Joe Biden';

-- Kamala Harris is former VP
UPDATE politicians SET candidate_status = 'Former', office_held = 'Former Vice President of the United States' WHERE name = 'Kamala Harris';

-- Eric Garcetti is no longer mayor (became ambassador)
UPDATE politicians SET candidate_status = 'Former', office_held = 'Former Mayor of Los Angeles' WHERE name = 'Eric Garcetti';
