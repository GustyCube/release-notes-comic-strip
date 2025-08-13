import * as core from "@actions/core";
import { client, currentTag, mergedPRsBetween, createOrUpdateReleaseWithAsset, repoInfo } from "./gh.js";
import { planPanels } from "./planner.js";
import { renderPanels } from "./images.js";
import { stitch1x4 } from "./compose.js";
import fs from "fs";
import path from "path";

async function run() {
  const octo = client();
  const { owner, repo } = repoInfo();
  let to = core.getInput("to") || await currentTag(octo, owner, repo);
  if (!to) throw new Error("No end tag detected. Push a tag or set inputs.to");
  let from = core.getInput("from") || await previousTag(octo, owner, repo, to);
  if (!from) throw new Error("No start tag detected. Set inputs.from");
  const prs = await mergedPRsBetween(octo, owner, repo, from, to);
  if (!prs.length) { core.setOutput("skipped","no-prs"); return; }
  const style = core.getInput("style") || "retro";
  const persona = core.getInput("persona") || "noir";
  const attachName = core.getInput("attach_as") || "release-comic.png";

  const plan = await planPanels(prs.slice(0,8), style, persona);
  const work = path.join(process.cwd(), "comic-art");
  fs.mkdirSync(work, { recursive: true });
  const panelPaths = await renderPanels(plan.panels, work, style);
  const outPNG = path.join(work, "comic-1x4.png");
  await stitch1x4(panelPaths, outPNG, plan.title, plan.panels, prs.slice(0, 4));

  const releaseBody = `## ${plan.title}\n\n${plan.alt}\n\n— Generated as a 1×4 comic from merged PRs between \`${from}\` → \`${to}\``;
  await createOrUpdateReleaseWithAsset(octo, owner, repo, to, plan.title, releaseBody, outPNG, attachName);
  core.setOutput("image", outPNG);
}

async function previousTag(octo:any, owner:string, repo:string, toTag:string) {
  const tags = await octo.rest.repos.listTags({ owner, repo, per_page: 100 });
  const names = tags.data.map((t: any)=>t.name);
  const i = names.indexOf(toTag);
  if (i<0) return names[1] || null;
  return names[i+1] || names[1] || null;
}

run().catch(e=>{ throw e });
