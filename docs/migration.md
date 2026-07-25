# Content migration

Technical reference for importing client-provided content into a Prismic repository — CMS exports, URL lists, documents, spreadsheets, or any other format the client hands off. Inventory, audit, redirects, and DNS cutover are out of scope for this doc.

## Prerequisites

- A Prismic repository on a plan that exposes a **Write Token** (paid feature). Free repos can author via the UI but cannot accept programmatic migrations.
- Custom Types and Slice schemas defined in [customtypes/](../customtypes) and [src/lib/slices/](../src/lib/slices). These are the target shapes.
- Environment variables:
  - `PRISMIC_REPOSITORY_NAME` — target repository
  - `PRISMIC_WRITE_TOKEN` — permanent write token, do not commit

## Modeling

Translate the source content into Prismic Custom Types and Slice variations. Decide:

- Which source content types collapse into a single Prismic type
- Which patterns become typed Slices
- How taxonomies map (categories/tags → Prismic relationship fields or repeatable groups)

Check the schemas into [customtypes/](../customtypes) so the model is reproducible.

## Migrate

Author a Node migration script using `@prismicio/client`'s Migration API (`createMigration` + `writeClient.migrate`) and `@prismicio/migrate`'s `htmlAsRichText` helper. See [scripts/import/migrate.example.ts](../scripts/import/migrate.example.ts) for the shape.

The script:

1. Reads source content (XML / JSON / CSV / etc.)
2. Normalizes each row into a Custom-Type-shaped document
3. Converts HTML bodies into Slice variations (`htmlAsRichText` for prose; custom mappers for typed Slices)
4. Uploads referenced media via `migration.createAsset()` (auto-deduped by source file)
5. Submits via `writeClient.migrate(migration, { reporter })`

**Constraints:**

- Prismic rate-limits the Migration API to **1 document/second per repository**. Plan accordingly for large imports.
- For new content models or large imports, run against a staging Prismic repository first; diff the output, confirm Slice shapes render correctly in Slice Simulator, then promote.
- Preserve authorship and original publish dates by setting them on each document.
