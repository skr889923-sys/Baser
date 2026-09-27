# Synthetic campus routing fixture

Copied from the user-supplied `campus-map/fixture` on 2026-09-06. These coordinates do not describe Suez Canal University. All three GeoJSON files retain `fixture: true`; `verified` is a simulated test value, not evidence of a field survey.

`network.json` adds Baser schema v1 metadata without inventing photos, survey dates or directional instructions. It can be imported into the admin network preview as a **draft only**. It cannot be published or passed into mobile guidance.

Regenerate to a new filename with:

    node scripts/prepare-campus-import.cjs data/campus-fixture /tmp/campus-fixture-new.json synthetic-campus 'حرم مصطنع للاختبار فقط' 'Synthetic test campus'

Run `npm test` for routing, direction, closure, evidence and validation scenarios. The first pilot planning document is `docs/pilot/FIELD_PILOT.md`.

Normalization correction: the supplied `n_junction_south` claimed wheelchair access while marked imagery. Its v1 draft value is `unknown`; source GeoJSON is retained for traceability.
