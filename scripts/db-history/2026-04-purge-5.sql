-- PHASE 5: Nuclear purge of ALL "State Official" entries
-- These are ALL from the unvalidated user request pipeline
-- Real state officials from OpenStates have proper titles: "State Senator", "State Representative", etc.

DELETE FROM claims WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM stance_changes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM trustworthiness_history WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM subscriber_politicians WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM politician_votes WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM politician_committees WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM promises WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM statements WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM positions WHERE politician_id IN (SELECT id FROM politicians WHERE office_held = 'State Official');
DELETE FROM politicians WHERE office_held = 'State Official';
