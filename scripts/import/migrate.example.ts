/**
 * Example Prismic migration script. Copy and adapt per source.
 *
 * Run with:
 *   PRISMIC_REPOSITORY_NAME=your-repo \
 *   PRISMIC_WRITE_TOKEN=xxx \
 *   pnpm tsx scripts/import/migrate.example.ts
 *
 * Requires:
 *   - @prismicio/client (already installed)
 *   - @prismicio/migrate (install per migration: `pnpm add -D @prismicio/migrate`)
 */
import * as prismic from "@prismicio/client";
import { htmlAsRichText } from "@prismicio/migrate";
import "dotenv/config";

const repositoryName = process.env.PRISMIC_REPOSITORY_NAME;
const writeToken = process.env.PRISMIC_WRITE_TOKEN;

if (!repositoryName || !writeToken) {
  throw new Error(
    "PRISMIC_REPOSITORY_NAME and PRISMIC_WRITE_TOKEN must be set.",
  );
}

interface SourcePost {
  slug: string;
  title: string;
  publishedAt: string;
  body_html: string;
  hero_url: string;
  hero_alt: string;
}

async function loadSource(): Promise<SourcePost[]> {
  // Replace with your source: WordPress XML, Drupal JSON:API, CSV, etc.
  return [];
}

async function main() {
  const writeClient = prismic.createWriteClient(repositoryName!, {
    writeToken: writeToken!,
  });
  const migration = prismic.createMigration();

  for (const post of await loadSource()) {
    const hero = migration.createAsset(post.hero_url, post.hero_alt);

    migration.createDocument(
      {
        type: "post",
        uid: post.slug,
        lang: "en-us",
        data: {
          title: post.title,
          published_at: post.publishedAt,
          hero_image: hero,
          slices: [
            {
              slice_type: "rich_text",
              variation: "default",
              primary: { content: htmlAsRichText(post.body_html).richText },
              items: [],
            },
          ],
        },
      },
      post.title,
    );
  }

  await writeClient.migrate(migration, {
    reporter: (event) => console.log(event.type, event),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
