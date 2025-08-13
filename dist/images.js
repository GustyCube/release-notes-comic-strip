import fs from "fs";
import path from "path";
import OpenAI from "openai";
export async function renderPanels(plans, outDir, style) {
    console.log("[Images] Starting image rendering...");
    fs.mkdirSync(outDir, { recursive: true });
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        throw new Error("OPENAI_API_KEY environment variable is required for image generation");
    }
    console.log("[Images] API key found for image generation");
    console.log("[Images] Will generate", plans.length, "images using DALL-E 3");
    const client = new OpenAI({ apiKey: key });
    const paths = [];
    for (let i = 0; i < 4; i++) {
        const p = plans[i];
        console.log(`[Images] Generating panel ${i + 1}/4 with prompt:`, p.prompt.substring(0, 100) + "...");
        try {
            // Add extra constraints to prevent multiple scenes
            const constrainedPrompt = `${p.prompt} IMPORTANT: Show only ONE single scene in this panel. Do not create a comic strip layout or multiple panels. This is just ONE panel of a larger comic.`;
            const response = await client.images.generate({
                model: "dall-e-3",
                prompt: constrainedPrompt,
                size: "1024x1024",
                quality: "standard",
                response_format: "b64_json",
                n: 1
            });
            console.log(`[Images] Panel ${i + 1} DALL-E 3 response received`);
            if (!response.data || !response.data[0]) {
                throw new Error(`No image data returned for panel ${i + 1}`);
            }
            const b64 = response.data[0].b64_json;
            if (!b64) {
                throw new Error(`No base64 image data returned for panel ${i + 1}`);
            }
            const file = path.join(outDir, `panel-${i + 1}.png`);
            fs.writeFileSync(file, Buffer.from(b64, "base64"));
            console.log(`[Images] Panel ${i + 1} saved to:`, file);
            if (response.data[0].revised_prompt) {
                console.log(`[Images] Panel ${i + 1} revised prompt:`, response.data[0].revised_prompt);
            }
            paths.push(file);
        }
        catch (error) {
            console.error(`[Images] Error generating panel ${i + 1}:`, error.message);
            throw error;
        }
    }
    console.log("[Images] All panels generated successfully using DALL-E 3");
    return paths;
}
