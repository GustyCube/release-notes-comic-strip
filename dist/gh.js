import * as github from "@actions/github";
export function client() {
    const token = process.env.GITHUB_TOKEN;
    if (!token)
        throw new Error("Missing GITHUB_TOKEN");
    return github.getOctokit(token);
}
export async function latestTag(octokit, owner, repo) {
    const tags = await octokit.rest.repos.listTags({ owner, repo, per_page: 100 });
    if (!tags.data.length)
        return null;
    return tags.data[0].name;
}
export async function mergedPRsBetween(octokit, owner, repo, base, head) {
    const compare = await octokit.rest.repos.compareCommits({ owner, repo, base, head, per_page: 100 });
    const shas = new Set(compare.data.commits.map(c => c.sha));
    const prs = [];
    for await (const res of octokit.paginate.iterator(octokit.rest.pulls.list, { owner, repo, state: "closed", per_page: 100 })) {
        for (const pr of res.data) {
            if (pr.merged_at && pr.merge_commit_sha && shas.has(pr.merge_commit_sha)) {
                prs.push({ number: pr.number, title: pr.title, body: pr.body, merged_at: pr.merged_at, user: pr.user, labels: pr.labels?.map(l => ({ name: l.name })) });
            }
        }
    }
    return prs;
}
export async function createOrUpdateReleaseWithAsset(octokit, owner, repo, tag, name, body, assetPath, assetName) {
    let release;
    try {
        release = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
    }
    catch {
        release = await octokit.rest.repos.createRelease({ owner, repo, tag_name: tag, name, body });
    }
    const relId = release.data.id;
    const fs = await import("fs");
    const mime = "image/png";
    const data = fs.readFileSync(assetPath);
    const existing = await octokit.rest.repos.listReleaseAssets({ owner, repo, release_id: relId, per_page: 100 });
    for (const a of existing.data)
        if (a.name === assetName)
            await octokit.rest.repos.deleteReleaseAsset({ owner, repo, asset_id: a.id });
    await octokit.rest.repos.uploadReleaseAsset({ owner, repo, release_id: relId, name: assetName, data: data, headers: { "content-type": mime, "content-length": data.length } });
}
export async function currentTag(octokit, owner, repo) {
    const ref = github.context.ref;
    if (ref.startsWith("refs/tags/"))
        return ref.replace("refs/tags/", "");
    const latest = await latestTag(octokit, owner, repo);
    return latest;
}
export function repoInfo() { return github.context.repo; }
export async function getPRCommits(octokit, owner, repo, prNumber) {
    const commits = await octokit.rest.pulls.listCommits({ owner, repo, pull_number: prNumber, per_page: 100 });
    return commits.data.map((c, index) => ({
        number: index + 1, // Use commit index as unique identifier
        title: c.commit.message.split('\n')[0],
        body: c.commit.message,
        user: { login: c.author?.login || c.commit.author?.name || 'unknown' },
        labels: [],
        sha: c.sha.substring(0, 7) // Include short SHA for reference
    }));
}
export async function postPRComment(octokit, owner, repo, prNumber, body, imagePath) {
    let commentBody = body;
    if (imagePath) {
        const fs = await import("fs");
        const data = fs.readFileSync(imagePath);
        const base64 = data.toString('base64');
        commentBody += `\n\n![Comic Strip](data:image/png;base64,${base64})`;
    }
    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody
    });
}
export function getPRContext() {
    const prNumber = github.context.payload.pull_request?.number;
    const eventName = github.context.eventName;
    return { prNumber, eventName };
}
