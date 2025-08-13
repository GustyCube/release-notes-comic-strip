import * as github from "@actions/github";
import * as core from "@actions/core";

export type PR = { number: number; title: string; body?: string|null; merged_at?: string|null; user?: {login:string} | null; labels?: {name:string}[] };

export function client() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");
  return github.getOctokit(token);
}

export async function latestTag(octokit: ReturnType<typeof client>, owner: string, repo: string) {
  const tags = await octokit.rest.repos.listTags({ owner, repo, per_page: 100 });
  if (!tags.data.length) return null;
  return tags.data[0].name;
}

export async function mergedPRsBetween(octokit: ReturnType<typeof client>, owner: string, repo: string, base: string, head: string) {
  const compare = await octokit.rest.repos.compareCommits({ owner, repo, base, head, per_page: 100 });
  const shas = new Set(compare.data.commits.map(c=>c.sha));
  const prs: PR[] = [];
  for await (const res of octokit.paginate.iterator(octokit.rest.pulls.list, { owner, repo, state: "closed", per_page: 100 })) {
    for (const pr of res.data) {
      if (pr.merged_at && pr.merge_commit_sha && shas.has(pr.merge_commit_sha)) {
        prs.push({ number: pr.number, title: pr.title, body: pr.body, merged_at: pr.merged_at, user: pr.user, labels: pr.labels?.map(l=>({name:l.name})) });
      }
    }
  }
  return prs;
}

export async function createOrUpdateReleaseWithAsset(octokit: ReturnType<typeof client>, owner: string, repo: string, tag: string, name: string, body: string, assetPath: string, assetName: string) {
  let release;
  try {
    release = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
  } catch {
    release = await octokit.rest.repos.createRelease({ owner, repo, tag_name: tag, name, body });
  }
  const relId = release.data.id;
  const fs = await import("fs");
  const mime = "image/png";
  const data = fs.readFileSync(assetPath);
  const existing = await octokit.rest.repos.listReleaseAssets({ owner, repo, release_id: relId, per_page: 100 });
  for (const a of existing.data) if (a.name === assetName) await octokit.rest.repos.deleteReleaseAsset({ owner, repo, asset_id: a.id });
  await octokit.rest.repos.uploadReleaseAsset({ owner, repo, release_id: relId, name: assetName, data: data as unknown as string, headers: { "content-type": mime, "content-length": data.length } as any });
}

export async function currentTag(octokit: ReturnType<typeof client>, owner: string, repo: string) {
  const ref = github.context.ref;
  if (ref.startsWith("refs/tags/")) return ref.replace("refs/tags/","");
  const latest = await latestTag(octokit, owner, repo);
  return latest;
}

export function repoInfo() { return github.context.repo; }
