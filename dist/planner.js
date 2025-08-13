import OpenAI from "openai";
export async function planPanels(prs, style, persona) {
    console.log("[Planner] Starting panel planning...");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is required");
    }
    console.log("[Planner] API key found");
    const title = deriveTitle(prs);
    const alt = prs.map(p => `• #${p.number} ${p.title}`).join("\n");
    console.log("[Planner] Title:", title);
    const client = new OpenAI({ apiKey });
    const sys = "You are a comic strip writer creating fun comics about software development. Output concise JSON with exactly four panels AND the 4 most significant commit numbers. Format: {title, panels:[{caption,dialogue,prompt}], alt, selectedPRNumbers:[]}. Each panel must include: caption (format: 'Commit #N: commit title'), dialogue (<=120 chars, upbeat and developer-friendly), prompt (IMPORTANT: Generate ONE SINGLE comic book panel showing ONE simple scene. Show 1-2 cartoon developer characters with clear expressions. Include ONE speech bubble with the dialogue text. Use classic comic book art style with bold outlines and flat colors. Focus on ONE main action or emotion per panel. Keep it simple and clear - do not try to show multiple scenes or complex layouts).";
    const prDetails = prs.map(pr => {
        let details = `#${pr.number} ${pr.title}`;
        if (pr.body && pr.body.trim()) {
            // Summarize body to avoid token limits
            const bodySummary = pr.body.trim().substring(0, 200);
            details += `\nDescription: ${bodySummary}${pr.body.length > 200 ? '...' : ''}`;
        }
        if (pr.labels && pr.labels.length > 0) {
            details += `\nLabels: ${pr.labels.map(l => l.name).join(', ')}`;
        }
        if (pr.user) {
            details += `\nAuthor: ${pr.user.login}`;
        }
        return details;
    }).join('\n\n');
    const userPrompt = `Persona: ${persona}. Art style: ${style}. 

Please analyze these Pull Requests and create a 4-panel comic story that captures the essence of these changes. Use the PR descriptions to understand what was actually changed and create visual scenes that represent the technical work done:

${prDetails}`;
    console.log("[Planner] Creating OpenAI client...");
    console.log("[Planner] Calling OpenAI API with model: gpt-4o");
    console.log("[Planner] User prompt:", userPrompt);
    try {
        const completion = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: sys },
                { role: "user", content: userPrompt },
                { role: "user", content: "Return JSON: { title, panels:[{caption,dialogue,prompt}], alt, selectedPRNumbers:[1,2,3,4] } with exactly 4 panels and 4 PR numbers." }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
        });
        console.log("[Planner] Chat completion API call successful");
        const resp = completion.choices[0].message.content;
        console.log("[Planner] Raw response:", resp);
        if (!resp) {
            throw new Error("Failed to get response from OpenAI API");
        }
        const parsed = safeParseJSON(resp);
        console.log("[Planner] Parsed response:", JSON.stringify(parsed, null, 2));
        if (!parsed || !Array.isArray(parsed.panels) || parsed.panels.length < 4) {
            console.error("[Planner] Invalid response format. Expected panels array with 4 items.");
            throw new Error("Invalid response format from OpenAI API");
        }
        parsed.title = parsed.title || title;
        parsed.alt = parsed.alt || alt;
        parsed.panels = parsed.panels.slice(0, 4);
        // Extract selected PRs based on AI selection
        const selectedPRNumbers = parsed.selectedPRNumbers || [];
        const selectedPRs = [];
        if (selectedPRNumbers.length > 0) {
            // Match selected PR numbers to actual PR objects
            for (const prNumber of selectedPRNumbers.slice(0, 4)) {
                const pr = prs.find(p => p.number === prNumber);
                if (pr)
                    selectedPRs.push(pr);
            }
        }
        // Fallback to first 4 PRs if AI didn't select enough or invalid numbers
        while (selectedPRs.length < 4 && selectedPRs.length < prs.length) {
            const nextPR = prs.find(p => !selectedPRs.includes(p));
            if (nextPR)
                selectedPRs.push(nextPR);
            else
                break;
        }
        parsed.selectedPRs = selectedPRs;
        console.log("[Planner] Selected PRs:", selectedPRs.map(p => `#${p.number}`).join(', '));
        console.log("[Planner] Final plan ready with", parsed.panels.length, "panels");
        return parsed;
    }
    catch (error) {
        console.error("[Planner] OpenAI API error:", error.message);
        if (error.response) {
            console.error("[Planner] Response status:", error.response.status);
            console.error("[Planner] Response data:", error.response.data);
        }
        throw error;
    }
}
function deriveTitle(prs) {
    const words = new Map();
    for (const p of prs)
        for (const w of p.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
            words.set(w, (words.get(w) || 0) + 1);
    const top = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
    return top.length ? `Release Saga: ${top.map(w => w[0].toUpperCase() + w.slice(1)).join(" · ")}` : "Release Saga";
}
function basePrompt(title, style) {
    return `Comic panel, ${style} style, developer office vibe, playful, minimal text in scene, theme: "${title}", clean vector, crisp lighting`;
}
function safeParseJSON(s) {
    try {
        return JSON.parse(s);
    }
    catch {
        return null;
    }
}
