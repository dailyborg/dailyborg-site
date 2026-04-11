DELETE FROM article_sources WHERE article_id IN (SELECT id FROM articles WHERE confidence_score = 50);
DELETE FROM article_entities WHERE article_id IN (SELECT id FROM articles WHERE confidence_score = 50);
DELETE FROM articles WHERE confidence_score = 50;