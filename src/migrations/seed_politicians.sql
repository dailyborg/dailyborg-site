-- Mock Methodology
INSERT OR IGNORE INTO methodology_versions (id, version_name, description, formula, created_at) VALUES 
('mv_test', 'v1.4 - Baseline', 'Standard algorithmic ingestion weightings for positional contradiction detection.', 'Score = MAX(0, 100 - ((Contradictions * 15) / Eligible Topics))', CURRENT_TIMESTAMP);

-- Mock Politician
INSERT OR IGNORE INTO politicians (id, slug, name, office_held, party, district_state, time_in_office) VALUES
('pol_001', 'sample-slug', 'Eleanor Vance', 'U.S. Senate', 'Democrat', 'OH', '4 Years, 2 Months');

-- Mock Promises
INSERT OR IGNORE INTO promises (id, politician_id, promise_text, date_said, issue_area, status) VALUES
('p_1', 'pol_001', 'Codify structural metadata guidelines into federal law', '2022-10-14', 'Tech Policy', 'In Progress'),
('p_2', 'pol_001', 'Lower corporate tax rates for syndicates', '2023-01-11', 'Economy', 'Broken'),
('p_3', 'pol_001', 'Increase funding for national algorithmic deployments', '2023-04-05', 'Infrastructure', 'Fulfilled');

-- Mock Positions for Consistency Tracker
INSERT OR IGNORE INTO positions (id, politician_id, topic, stance, statement_date, source_excerpt) VALUES
('pos_1', 'pol_001', 'Digital Privacy Expansion', 'Support', '2021-11-04', 'Vance stated early support during campaign trail.'),
('pos_2', 'pol_001', 'Digital Privacy Expansion', 'Strongly Oppose', '2024-02-15', 'Vance reversed course voting against the 2024 Privacy Act.'),
('pos_3', 'pol_001', 'Defense Spending Reduction', 'Neutral', '2022-05-10', 'Refused to take a hard stance on cutting military budget.'),
('pos_4', 'pol_001', 'Defense Spending Reduction', 'Support', '2023-09-22', 'Signed a letter backing 5% cuts to standard procurement.');
