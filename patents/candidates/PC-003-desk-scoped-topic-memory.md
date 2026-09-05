# PC-003 Desk-scoped differential context memory for automated newsroom generation

Plain description: each editorial desk keeps its own small memory of recent story titles in a durable object; the last few are injected into the writing prompt so the model avoids repeating an angle, and the memory is pruned to 20 entries.

Inherited from the previous build (workers/ingest, TopicMemoryAgent). Prior art to check: retrieval-augmented generation with per-topic memory, deduplication by embeddings.

Status: candidate.
