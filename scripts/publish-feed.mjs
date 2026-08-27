// Fetches posts from the ATProto PDS, regenerates feed.xml, and
// auto-posts any newly-published post to Bluesky.
//
// Run via GitHub Actions (see .github/workflows/publish.yml), or
// locally with: node scripts/publish-feed.mjs
//
// Required env vars for Bluesky auto-posting:
//   BSKY_HANDLE        — e.g. "suz.al"
//   BSKY_APP_PASSWORD  — an App Password from Bluesky settings
//                        (NOT your main account password)

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const HANDLE = "suz.al";
const PUBLICATION_RKEY = "3mty4vylnus2z";
const SITE_ORIGIN = "https://suz.al";
const BLOG_BASE_PATH = "/blog.html";

const POSTED_LOG = new URL("../posted.json", import.meta.url);
const FEED_OUTPUT = new URL("../feed.xml", import.meta.url);

async function resolveHandleToDidAndPds(handle) {
  const res = await fetch(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`
  );
  const { did } = await res.json();
  const didDoc = await fetch(`https://plc.directory/${did}`).then((r) => r.json());
  const pds = didDoc.service.find((s) => s.id === "#atproto_pds").serviceEndpoint;
  return { did, pds };
}

async function listRecords(pds, did, collection) {
  const records = [];
  let cursor;
  do {
    const url = new URL(`${pds}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set("repo", did);
    url.searchParams.set("collection", collection);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url);
    const data = await res.json();
    records.push(...(data.records || []));
    cursor = data.cursor;
  } while (cursor);
  return records;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildRss(siteName, siteDesc, posts) {
  const items = posts
    .map((p) => {
      const link = `${SITE_ORIGIN}${BLOG_BASE_PATH}${p.path}`;
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(p.description || "")}</description>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${SITE_ORIGIN}${BLOG_BASE_PATH}</link>
    <description>${escapeXml(siteDesc || "")}</description>
${items}
  </channel>
</rss>
`;
}

async function loadPostedLog() {
  if (!existsSync(POSTED_LOG)) return null; // null = "no log yet, first run"
  const raw = await readFile(POSTED_LOG, "utf-8");
  return JSON.parse(raw);
}

async function savePostedLog(rkeys) {
  await writeFile(POSTED_LOG, JSON.stringify(rkeys, null, 2) + "\n", "utf-8");
}

async function postToBluesky(handle, appPassword, post) {
  const sessionRes = await fetch(
    "https://bsky.social/xrpc/com.atproto.server.createSession",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
    }
  );
  const session = await sessionRes.json();
  if (!session.accessJwt) {
    throw new Error("Bluesky login failed: " + JSON.stringify(session));
  }

  const link = `${SITE_ORIGIN}${BLOG_BASE_PATH}${post.path}`;
  const text = `${post.title}\n\n${link}`;

  const record = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: link,
        title: post.title,
        description: post.description || "",
      },
    },
  };

  const postRes = await fetch(
    "https://bsky.social/xrpc/com.atproto.repo.createRecord",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record,
      }),
    }
  );
  const result = await postRes.json();
  if (!postRes.ok) {
    throw new Error("Bluesky post failed: " + JSON.stringify(result));
  }
  console.log(`Posted to Bluesky: ${post.title}`);
}

async function main() {
  const { did, pds } = await resolveHandleToDidAndPds(HANDLE);

  const [publications, documents] = await Promise.all([
    listRecords(pds, did, "site.standard.publication"),
    listRecords(pds, did, "site.standard.document"),
  ]);

  const pubRecord = publications.find((p) => p.uri.endsWith(`/${PUBLICATION_RKEY}`));
  if (!pubRecord) throw new Error("Could not find the target publication.");
  const pubUri = pubRecord.uri;
  const siteName = pubRecord.value.name || HANDLE;
  const siteDesc = pubRecord.value.description || "";

  const posts = documents
    .filter((d) => d.value.site === pubUri)
    .map((d) => ({
      rkey: d.uri.split("/").pop(),
      title: d.value.title || "Untitled",
      description: d.value.description || "",
      path: d.value.path || `/${d.uri.split("/").pop()}`,
      publishedAt: d.value.publishedAt || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt)); // oldest first

  // Regenerate the RSS feed (newest first, per convention)
  const rss = buildRss(siteName, siteDesc, [...posts].reverse());
  await writeFile(FEED_OUTPUT, rss, "utf-8");
  console.log(`Wrote feed.xml with ${posts.length} posts.`);

  // Bluesky auto-posting
  const existingLog = await loadPostedLog();

  if (existingLog === null) {
    // First run ever: treat all current posts as already-seen so we
    // don't mass-post your entire backlog to Bluesky at once.
    await savePostedLog(posts.map((p) => p.rkey));
    console.log(`Bootstrapped posted.json with ${posts.length} existing posts. No posts sent to Bluesky this run.`);
    return;
  }

  const postedSet = new Set(existingLog);
  const newPosts = posts.filter((p) => !postedSet.has(p.rkey));

  if (newPosts.length === 0) {
    console.log("No new posts to share.");
    return;
  }

  const handle = process.env.BSKY_HANDLE || HANDLE;
  const appPassword = process.env.BSKY_APP_PASSWORD;
  if (!appPassword) {
    throw new Error("BSKY_APP_PASSWORD is not set — cannot post to Bluesky.");
  }

  for (const post of newPosts) {
    await postToBluesky(handle, appPassword, post);
    postedSet.add(post.rkey);
  }

  await savePostedLog([...postedSet]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
