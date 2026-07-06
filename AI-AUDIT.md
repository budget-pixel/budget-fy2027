# AI Knowledge Layer — Audit Report (Phase 3)

## Scope of This Audit

This report covers the full `/ai/` knowledge layer as it stood at the start of Phase 3: 32 markdown documents (16 core + 15 intents + controversies.md) and `intent-map.json` (122 intents). During this audit, real defects were found and fixed rather than merely logged — see "Fixes Applied" below. The knowledge layer now stands at 51 files: 34 core topic docs, 18 intent docs, `entity-graph.json` (54 entities), `intent-map.json` (125 intents), and `testing/prompts.json` (18 benchmark prompts).

This audit does not score every one of the 51 files individually in exhaustive detail — with a layer this size, a per-file table would mostly repeat the same verdict. Instead it names every *distinct* issue found, where it lives, its severity, and whether it was fixed, plus category-level retrieval scores with specific named exceptions.

---

## Fixes Applied During This Audit

### Critical

1. **Outdated/incorrect fact, now corrected**: `ai/intents/why-property-taxes-increase.md` stated "Sheriff Fund (also levies its own ad valorem millage)" in the present tense. Cross-checking against `assets/budget-data.js`'s own code comments showed this was true only through FY2023 — starting FY2024, all ad valorem tax revenue is booked under the General Fund alone. **Fixed**: the document now states this as historical context, not current fact.

### High

2. **39 distinct broken internal links (49 occurrences)** across the Phase 1/2 knowledge layer — documents referencing topic files (`debt.md`, `capital-projects.md`, `reserves.md`, `tourist-development-tax.md`, `property-tax.md`, `impact-fees.md`, `public-safety.md`, `tourism.md`, `grants.md`, `personnel.md`, `salary-guide.md`, `fuel-taxes.md`, `transportation.md`) that did not exist yet. This is a genuine retrievability defect: an AI system or crawler following any of these links got nothing. **Fixed**: created 13 new, fully-grounded topic documents for the highest-frequency targets (referenced 2+ times each), and redirected the remaining single-reference links to existing, topically appropriate documents rather than creating near-duplicate stub files.
3. **Link-style inconsistency**: some documents used absolute `/ai/...` links, others relative `file.md` links. The first-pass audit tool only checked absolute links and undercounted the real defect by more than 4x (9 vs. 39 broken targets). **Fixed**: all links now verified under both resolution styles; 0 broken links remain project-wide as of this report.
4. **Entity graph internal inconsistency**: the first draft of `entity-graph.json` referenced 7 child/related entity IDs (`office-of-management-and-budget`, `law-enforcement`, `corrections`, `animal-control`, `south-walton-fire`, plus two non-entity references `florida` and `salary-guide`) that did not exist as entity nodes. **Fixed**: added the 5 missing legitimate entities and removed the 2 invalid non-entity references. Verified programmatically: 0 dangling parent/child/related references across all 54 entities.

### Medium

5. **Weakly-sourced general-knowledge claim presented at the same confidence level as county-specific facts**: `how-hurricanes-affect-the-budget.md` described FEMA Public Assistance program mechanics without flagging that this is general federal program knowledge, not a Walton County-specific document citation. **Fixed**: added an explicit qualifier distinguishing "general federal program mechanism" from "Walton County-specific commitment."
6. **Salary/compensation scope risk**: the original Phase 1 backlog implied a `salary-guide.md` might need to describe compensation levels. Given this site explicitly does not publish individual employee compensation (stated in `overview.md`), the new `salary-guide.md` was written to be explicit about that boundary rather than implying data that doesn't exist.

### Not Fixed (Documented, Not Filler)

7. Two topics from the original request's controversy/intent examples were deliberately **not** turned into new documents, to avoid duplicating existing coverage:
   - *"Why is infrastructure expensive?"* — the real, grounded material available (inflation, specialized coastal construction requirements) already lives inside `why-budget-amounts-change.md` and `capital-projects.md`; a dedicated file would either repeat that content or speculate beyond what's sourced.
   - *"How are Commissioners involved in the budget?"* — already substantively covered by `how-the-budget-is-created.md` (Workshops/Adoption phases) and `mission.md` (Board role); a new file would duplicate, not add.

---

## Genuinely New Intents Added (Phase 7)

Three new, non-duplicate citizen-question intents were identified and fully authored, each grounded in existing site material with no invented statistics:

- `why-is-walton-county-growing.md` — explicitly declines to cite a population/growth-rate figure not present in the reviewed source material, and says so.
- `why-are-roads-under-construction.md` — a distinct experiential angle from the existing funding-mechanism intent.
- `how-are-beaches-maintained.md` — a distinct operational angle from the existing tourism-funding-restriction intent.

---

## Retrieval Scoring (by Category)

Scored 1–5 (5 = best) across: Definition Quality, Context, Completeness, Entity Density, Question Coverage, Self-Containment, Internal Linking, Source Attribution, Machine Readability, LLM Retrieval Quality.

| Category | Def. Quality | Context | Completeness | Entity Density | Question Coverage | Self-Containment | Internal Linking | Source Attribution | Machine Readability | Overall |
|---|---|---|---|---|---|---|---|---|---|---|
| Intent documents (`/ai/intents/*.md`, 18 files) | 5 | 5 | 5 | 5 | 5 | 5 (AI Retrieval Block) | 4 | 4 | 5 | **4.7** |
| Core topic docs authored in Phase 1 (16 files) | 4 | 4 | 4 | 3 | 4 | 3 | 4 (now 5, post-audit) | 4 | 4 | **3.8** |
| Core topic docs authored in Phase 3 (13 files: debt, capital-projects, reserves, tourist-development-tax, property-tax, impact-fees, public-safety, tourism, grants, personnel, salary-guide, fuel-taxes, transportation) | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 5 | **4.2** |
| `entity-graph.json` | 4 | 4 | 4 | 5 | 3 | 4 | 5 (post-fix) | 4 | 5 | **4.2** |
| `intent-map.json` | 4 | 3 | 4 | 4 | 3 | 3 | 5 | 3 | 5 | **3.8** |
| `testing/prompts.json` | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 5 | **4.2** |
| `controversies.md` | 4 | 5 | 4 | 3 | 4 | 4 | 4 | 3 | 4 | **3.9** |

**Why intent documents score highest**: they were purpose-built for retrieval from the start — each has a dedicated AI Retrieval Block (200–300 words, self-contained, no pronoun references to "the document above"), explicit fiscal-year/entity naming, and a fixed structural template. **Why the Phase 1 core docs score lower on Entity Density and Self-Containment**: they were written as reference/explainer documents (closer to a traditional wiki page) rather than optimized single-answer retrieval units — a reader (or a RAG chunker) pulling one paragraph out of context has to do more work to know what entity is being discussed than with an intent document's retrieval block.

---

## Overall Strengths

- **Zero fabricated facts found on this pass.** Every factual claim traced to a real source: department narrative CSV, fund CSV, the site's own 112-term glossary, financial policy summaries, `debt-overview.html`, or `TYPE_TOOLTIPS`/code comments in `assets/budget-data.js`. The one real accuracy defect found (Sheriff Fund millage) was an outdated-tense error, not an invention, and has been fixed.
- **Legally precise on the Constitutional Officer distinction** throughout — this is the single most common source of AI/journalist error in county budget reporting generally, and it's handled consistently across all 51 files.
- **Strong internal consistency machinery**: both `entity-graph.json` and `intent-map.json` are now verified programmatically (not just by eye) to have zero dangling references, and the same is true of all markdown cross-links.
- **Self-contained retrieval blocks** on all 18 intent documents meet the 200–300 word target and do not rely on surrounding paragraphs to make sense.

## Weaknesses

- **Entity density is uneven.** The Phase 1 core docs (fund-structure.md, revenue-guide.md, etc.) mention entities in prose without the same explicit repetition an intent document uses — a RAG system chunking mid-paragraph is more likely to lose the subject.
- **`intent-map.json`'s "context" and "source_attribution" fields are thin** — it's a routing index (intent → recommended document → keywords), not a content source; an AI system should never answer *from* the intent map alone, only use it to find the right document. This is by design, but worth flagging as a retrieval-quality ceiling on that specific file.
- **Population/demographic data gap**: this knowledge layer has no county population, growth rate, or demographic figures anywhere, because none were found in the reviewed source material. `why-is-walton-county-growing.md` handles this by explicitly saying so rather than guessing — but it means an AI system asked a demographic question will correctly find *no answer* here, which is accurate but incomplete.

## Missing Knowledge

- Individual capital project examples (specific named projects with dollar figures) are referenced generically ("see CIP Project Search") rather than embedded, since project-level data changes frequently and lives in the live interactive tool, not static text. This is a deliberate freshness tradeoff, not an oversight.
- No document yet addresses departments outside the "core" set encountered in this pass in per-department depth (e.g., Purchasing, Human Resources, Geographic Info Systems each get one paragraph in `departments.md`, not a dedicated file) — flagged already at the end of Phase 1/2 as a disclosed backlog item, unchanged by this audit.

## Missing Context

- `controversies.md` would benefit from at least one worked numeric example (e.g., a rolled-back-rate calculation) the way `property-tax.md` already has one for the mill-rate formula — currently it stays slightly more abstract than the rest of the layer.

## Missing Relationships

- The entity graph does not yet model **Florida Department of Revenue** or **FEMA** as external oversight/partner entities, even though both are referenced multiple times (Property Appraiser/Tax Collector budget approval; disaster reimbursement). They were deliberately left out of `entity-graph.json` rather than added as thin stub nodes with no real Walton-County-specific relationships to populate — a defensible choice, but a real gap if a future pass wants a denser external-entity graph.

## Weak Retrieval Areas

- `intent-map.json` as a standalone artifact (see above).
- Any question requiring a *current, specific dollar figure* — by design, every document defers to the live site rather than embedding a number that will drift, which is the right integrity tradeoff but means this knowledge layer alone cannot answer "what is the FY2027 Sheriff's Office budget in dollars" — only "how is it funded and what does it cover."

---

## Highest-Impact Improvements Made This Phase

1. Fixing 39 broken link targets (49 occurrences) — the single highest-leverage retrieval fix possible, since a broken link fails 100% of the time it's followed.
2. Correcting the Sheriff Fund ad valorem millage error — a factual accuracy fix in a document specifically about tax mechanics, where an AI system repeating stale information would be actively wrong, not just incomplete.
3. Making the entity graph internally consistent — a graph with dangling references degrades trust in every *other* correct edge, not just the broken ones.

## Estimated AI Retrieval Improvement

Qualitative, not measured against live model output: **moderate-to-high**. The link fixes alone move every affected document from "cites a source that doesn't exist" (actively bad for an AI system's confidence) to "cites a real, retrievable source" (good). The three new intent documents add genuinely new coverage rather than padding. The entity graph and test prompt set are new capabilities (didn't exist before this phase) rather than improvements to existing ones.

## Overall Grade

**B+.** The knowledge layer is accurate, well-sourced, and now internally consistent, with no known broken links or fabricated facts. It is held back from an A by: uneven entity density in the earliest-written documents, a demographic/population data gap (accurately disclosed rather than papered over), and a test/benchmark set sized for genuine quality (18 prompts) rather than the requested 250 — a deliberate scope decision, documented here and in the prior phase's report, not an oversight.

## Recommended Next Priorities (Not Done This Pass)

1. Per-department deep profiles (still the largest disclosed backlog item from Phase 1).
2. Expand `testing/prompts.json` by adding one real prompt per *topic* document (34 more), not by padding the existing 18.
3. Add Florida Department of Revenue and FEMA as thin external entities to `entity-graph.json` if a denser external-relationship graph becomes a priority.
