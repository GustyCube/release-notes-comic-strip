import fs from "fs";
import { createCanvas, loadImage } from "canvas";
import type { PanelPlan } from "./planner.js";
import type { PR } from "./gh.js";

export async function stitch1x4(panelPaths: string[], outPath: string, title: string, panels?: PanelPlan[], prs?: PR[]) {
  if (panelPaths.length !== 4) throw new Error("stitch1x4 expects exactly 4 panels");
  const imgs = [];
  for (const p of panelPaths) imgs.push(await loadImage(p));
  
  const pad = 15;
  const borderWidth = 4;
  const titleH = 80;
  const captionH = 35; // Height for PR titles above each panel
  const panelW = imgs[0].width;
  const panelH = imgs[0].height;
  const W = 4*panelW + 5*pad;
  const H = panelH + 2*pad + titleH + captionH;
  
  const c = createCanvas(W,H);
  const ctx = c.getContext("2d");
  
  // White background
  ctx.fillStyle="#ffffff"; 
  ctx.fillRect(0,0,W,H);
  
  // Comic book style outer border
  ctx.strokeStyle="#000000";
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(borderWidth/2, borderWidth/2, W-borderWidth, H-borderWidth);
  
  // Main title in comic book font
  ctx.fillStyle="#000000"; 
  ctx.font="bold 44px 'Arial Black', sans-serif"; 
  ctx.textAlign = "center";
  ctx.fillText(title, W/2, 50);
  
  // Subtitle line
  ctx.strokeStyle="#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, titleH - 10);
  ctx.lineTo(W - pad, titleH - 10);
  ctx.stroke();
  
  // Draw each panel with comic styling
  for (let i=0;i<4;i++) {
    const x = pad + i*(panelW+pad);
    const y = titleH + captionH;
    
    // Panel caption - show PR number and title
    if ((prs && prs[i]) || (panels && panels[i])) {
      ctx.font="bold 14px 'Arial', sans-serif";
      ctx.textAlign = "center";
      
      // Draw caption background (yellow comic caption box)
      ctx.fillStyle="#ffeb3b";
      ctx.fillRect(x, y - captionH + 5, panelW, captionH - 10);
      ctx.strokeStyle="#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - captionH + 5, panelW, captionH - 10);
      
      // Draw PR title text
      ctx.fillStyle="#000000";
      let captionText = "";
      if (prs && prs[i]) {
        captionText = `#${prs[i].number}: ${prs[i].title}`;
      } else if (panels && panels[i] && panels[i].caption.includes("#")) {
        captionText = panels[i].caption;
      }
      
      // Truncate if too long
      if (captionText.length > 50) {
        captionText = captionText.substring(0, 47) + "...";
      }
      ctx.fillText(captionText, x + panelW/2, y - 10);
    }
    
    // Draw panel border (comic book style)
    ctx.strokeStyle="#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, panelW, panelH);
    
    // Draw the panel image
    ctx.drawImage(imgs[i], x, y);
    
    // Add panel number in corner
    ctx.fillStyle="#ffffff";
    ctx.fillRect(x + 5, y + 5, 30, 30);
    ctx.strokeStyle="#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, y + 5, 30, 30);
    ctx.fillStyle="#000000";
    ctx.font="bold 18px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${i+1}`, x + 20, y + 26);
  }
  
  // Add vertical gutter lines between panels
  ctx.strokeStyle="#333333";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  for (let i=1; i<4; i++) {
    const x = pad/2 + i*(panelW+pad);
    ctx.beginPath();
    ctx.moveTo(x, titleH);
    ctx.lineTo(x, H - pad);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  
  fs.writeFileSync(outPath, c.toBuffer("image/png"));
}
