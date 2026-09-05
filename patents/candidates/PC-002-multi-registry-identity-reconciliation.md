# PC-002 Multi-registry identity reconciliation for public officials

Plain description: keeping one record per official when the same person appears in several public datasets (Congress roster, executive roster, state legislature roster, Wikidata, reader requests) without ever matching on partial names.

Technical method: precedence order for keys (bioguide id, OpenStates id, Wikidata id, exact slug, exact full-name key built from letters and digits only, including nickname forms); state rows carry a state suffix in the slug; rows claimed in a sync are excluded from later matches in the same run; unclaimed rows from the same source are marked former; legacy duplicates are cascade-deleted.

Why it may be novel: the deterministic precedence and claim tracking across heterogeneous registries. Prior art to check: entity resolution literature, OpenStates person matching, Wikidata reconciliation services (OpenRefine).

Status: candidate.
