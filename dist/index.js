import * as core from "@actions/core";
import { client, currentTag, mergedPRsBetween, createOrUpdateReleaseWithAsset, repoInfo, getPRCommits, postPRComment, getPRContext } from "./gh.js";
import { planPanels } from "./planner.js";
import { renderPanels } from "./images.js";
import { stitch1x4 } from "./compose.js";
import fs from "fs";
import path from "path";
async function run() {
    const octo = client();
    const { owner, repo } = repoInfo();
    const { prNumber, eventName } = getPRContext();
    console.log(`[Debug] Event: ${eventName}, PR: ${prNumber}, Owner: ${owner}, Repo: ${repo}`);
    // Always post a debug comment first
    if (eventName === 'pull_request' && prNumber) {
        try {
            await octo.rest.issues.createComment({
                owner, repo,
                issue_number: prNumber,
                body: `🔍 **Debug Info**\n- Event: ${eventName}\n- PR: #${prNumber}\n- Repo: ${owner}/${repo}\n- OpenAI Key: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}\n- Starting comic generation...`
            });
        }
        catch (e) {
            console.log('[Debug] Failed to post debug comment:', e.message);
        }
    }
    let prs;
    let from, to;
    if (eventName === 'pull_request' && prNumber) {
        // PR mode: generate comic from PR commits
        console.log(`[PR Mode] Generating comic for PR #${prNumber}`);
        prs = await getPRCommits(octo, owner, repo, prNumber);
        if (!prs.length) {
            core.setOutput("skipped", "no-commits");
            return;
        }
    }
    else {
        // Release mode: generate comic from merged PRs between tags
        to = core.getInput("to") || await currentTag(octo, owner, repo);
        if (!to)
            throw new Error("No end tag detected. Push a tag or set inputs.to");
        from = core.getInput("from") || await previousTag(octo, owner, repo, to);
        if (!from)
            throw new Error("No start tag detected. Set inputs.from");
        prs = await mergedPRsBetween(octo, owner, repo, from, to);
        if (!prs.length) {
            core.setOutput("skipped", "no-prs");
            return;
        }
    }
    const style = core.getInput("style") || "comic";
    const persona = core.getInput("persona") || "friendly";
    const attachName = core.getInput("attach_as") || "release-comic.png";
    const plan = await planPanels(prs.slice(0, 8), style, persona);
    const work = path.join(process.cwd(), "comic-art");
    fs.mkdirSync(work, { recursive: true });
    const panelPaths = await renderPanels(plan.panels, work, style);
    const outPNG = path.join(work, "comic-1x4.png");
    await stitch1x4(panelPaths, outPNG, plan.title, plan.panels, plan.selectedPRs);
    if (eventName === 'pull_request' && prNumber) {
        // Post comic as PR comment
        const commentBody = `## ${plan.title}\n\n${plan.alt}\n\n— Generated comic from commits in this PR 🎨`;
        await postPRComment(octo, owner, repo, prNumber, commentBody, outPNG);
        core.setOutput("pr_comment", "posted");
    }
    else {
        // Attach to release (original behavior)
        const releaseBody = `## ${plan.title}\n\n${plan.alt}\n\n— Generated as a 1×4 comic from merged PRs between \`${from}\` → \`${to}\``;
        if (!to)
            throw new Error("Missing 'to' tag for release mode");
        await createOrUpdateReleaseWithAsset(octo, owner, repo, to, plan.title, releaseBody, outPNG, attachName);
    }
    core.setOutput("image", outPNG);
}
async function previousTag(octo, owner, repo, toTag) {
    const tags = await octo.rest.repos.listTags({ owner, repo, per_page: 100 });
    const names = tags.data.map((t) => t.name);
    const i = names.indexOf(toTag);
    if (i < 0)
        return names[1] || null;
    return names[i + 1] || names[1] || null;
}
run().catch(e => { throw e; });
