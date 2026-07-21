/**
 * Asks Google to index the docs pages a push added.
 *
 * Runs from the docs-google-indexing workflow on every push to main. Needs Node
 * 22.18+, which runs TypeScript on its own, so there is no build step.
 *
 *   node .github/scripts/submit-google-indexing.ts            # compare a push
 *
 * With no file names, the script compares BASE_SHA to HEAD_SHA and takes the
 * .mdx files that range added. Only added files count, so editing a page that is
 * already live does not send it again. Moving a page counts as adding one,
 * because the new path is a URL Google has not seen. Naming files yourself skips
 * the compare, which is how the workflow sends a page by hand. Either way, a
 * path turns into a URL only if it is an .mdx file inside the docs package and
 * outside snippets/, which holds parts of pages rather than pages.
 *
 * Environment:
 *   GOOGLE_CLIENT_EMAIL   Service account email (`client_email` in the key JSON).
 *   GOOGLE_PRIVATE_KEY    Service account private key (`private_key` in the key
 *                         JSON). Takes a real PEM, a PEM whose line breaks are
 *                         written as \n, or a PEM packed as base64.
 *   BASE_SHA              Commit before the push. Needed unless files are named.
 *   HEAD_SHA              Commit after the push. Defaults to HEAD.
 *   DOCS_BASE_URL         Defaults to https://docs.creem.io
 *
 * The service account needs the `indexing` scope, the Indexing API turned on for
 * its project, and it must own the docs.creem.io site in Search Console. A 403
 * nearly always means that last step is missing.
 */

import { execFileSync } from "node:child_process";
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";

/** Give up on a hung call instead of letting the job sit until GitHub kills it. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Tries per URL, counting the first one. Waits 2s, then 4s, then 6s. */
const MAX_ATTEMPTS = 4;

/** Path prefix, relative to the repo root, that holds the docs site. */
const DOCS_ROOT = "packages/docs/";

/** Directories under DOCS_ROOT whose .mdx files are not routable pages. */
const NON_PAGE_DIRS = ["snippets/"];

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

const PEM_HEADER = "-----BEGIN";

/**
 * A private key comes out of a GitHub secret in one of three shapes: a real PEM
 * with line breaks, one long line where the breaks are written as `\n` (what you
 * get by copying the field out of the key JSON), or a PEM written as base64.
 * Turn all three back into a real PEM.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();

  // Passing the value through a shell or YAML can leave quotes around it.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  if (!key.startsWith(PEM_HEADER)) {
    const decoded = Buffer.from(key, "base64").toString("utf8");
    if (decoded.trimStart().startsWith(PEM_HEADER)) {
      key = decoded.trim();
    }
  }

  key = key.replace(/\\n/g, "\n");

  if (!key.startsWith(PEM_HEADER)) {
    throw new Error("GOOGLE_PRIVATE_KEY is not a PEM private key (expected a -----BEGIN header).");
  }
  return key;
}

function loadServiceAccount(): ServiceAccount {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  const missing = [
    clientEmail ? null : "GOOGLE_CLIENT_EMAIL",
    privateKey ? null : "GOOGLE_PRIVATE_KEY",
  ].filter((name) => name !== null);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}.`);
  }

  return {
    client_email: clientEmail!.trim(),
    private_key: normalizePrivateKey(privateKey!),
  };
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: INDEXING_SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(account.private_key));
  const assertion = `${header}.${claims}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Token request failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("Token response did not include an access_token.");
  }
  return body.access_token;
}

/**
 * Turns `packages/docs/integrations/framer.mdx` into
 * `https://docs.creem.io/integrations/framer`. Gives back null when the file is
 * not a live page.
 */
export function toPageUrl(filePath: string, baseUrl: string): string | null {
  const normalized = filePath.trim().replace(/^\.\//, "");
  if (!normalized.startsWith(DOCS_ROOT) || !normalized.endsWith(".mdx")) {
    return null;
  }

  const slug = normalized.slice(DOCS_ROOT.length, -".mdx".length);
  if (NON_PAGE_DIRS.some((dir) => slug.startsWith(dir))) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}/${slug}`;
}

/**
 * Paths of the .mdx pages that `base..head` added.
 *
 * `--diff-filter=A` keeps only added files, so editing a page does not send it
 * again. `--no-renames` makes a moved page count as added. Without it, git calls
 * the move a rename and skips it, yet the new path is a URL Google has not seen.
 * In the file pattern below, `*` also matches `/`, so it finds pages in any
 * folder. (`**` would wrongly require a folder in between.) execFileSync hands
 * the arguments straight to git without a shell, so a strange file name cannot
 * run a command here.
 */
export function getAddedPages(base: string, head: string): string[] {
  const stdout = execFileSync(
    "git",
    [
      "diff",
      "--no-renames",
      "--name-only",
      "--diff-filter=A",
      base,
      head,
      "--",
      `${DOCS_ROOT}*.mdx`,
    ],
    { encoding: "utf8" },
  );
  return stdout.split("\n").filter((line) => line.trim() !== "");
}

async function requestIndexing(accessToken: string, url: string, attempt = 1): Promise<void> {
  const response = await fetch(PUBLISH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.ok) {
    console.log(`  submitted ${url}`);
    return;
  }

  const detail = await response.text();

  // 429 means we hit the daily cap (200 by default). 5xx means Google is flaky.
  const isRetryable = response.status === 429 || response.status >= 500;
  if (isRetryable && attempt < MAX_ATTEMPTS) {
    // Counting up, not down, so the wait never depends on the starting value.
    const backoffMs = attempt * 2000;
    console.log(
      `  retrying ${url} after ${response.status} (attempt ${attempt} of ${MAX_ATTEMPTS})`,
    );
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    return requestIndexing(accessToken, url, attempt + 1);
  }

  if (response.status === 403) {
    throw new Error(
      `Forbidden for ${url}. Confirm the service account is a verified owner of the ` +
        `Search Console property and that the Indexing API is enabled.\n${detail}`,
    );
  }
  throw new Error(`Failed to submit ${url} (${response.status}): ${detail}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const explicitFiles = args.filter((arg) => !arg.startsWith("--") && arg.trim() !== "");
  const baseUrl = process.env.DOCS_BASE_URL ?? "https://docs.creem.io";

  let files: string[];
  if (explicitFiles.length > 0) {
    files = explicitFiles;
  } else {
    const base = process.env.BASE_SHA;
    if (!base) {
      throw new Error("Pass page paths as arguments, or set BASE_SHA to diff a push.");
    }
    files = getAddedPages(base, process.env.HEAD_SHA ?? "HEAD");
  }

  const urls = [
    ...new Set(files.map((file) => toPageUrl(file, baseUrl)).filter((url) => url !== null)),
  ];

  if (urls.length === 0) {
    console.log("No new docs pages to submit.");
    return;
  }

  console.log(`Found ${urls.length} new page(s):`);
  urls.forEach((url) => console.log(`  ${url}`));

  if (dryRun) {
    console.log("Dry run, nothing submitted.");
    return;
  }

  const accessToken = await getAccessToken(loadServiceAccount());
  console.log("Submitting to the Google Indexing API...");
  for (const url of urls) {
    await requestIndexing(accessToken, url);
  }
  console.log(`Done. Submitted ${urls.length} page(s).`);
}

// Print just the message. A stack trace tells a docs writer nothing.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
