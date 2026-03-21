import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { VOICEOVER_CLIPS } from "./voiceover-scripts";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel (default)
const OUTPUT_DIR = join(import.meta.dirname, "clips");

async function generateClip(clip: (typeof VOICEOVER_CLIPS)[number]): Promise<void> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY environment variable is required");
  }

  const outPath = join(OUTPUT_DIR, `${clip.id}.mp3`);
  if (existsSync(outPath)) {
    console.log(`  Skipping ${clip.id} (already exists)`);
    return;
  }

  console.log(`  Generating ${clip.id}...`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: clip.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error for ${clip.id}: ${response.status} ${error}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outPath, buffer);
  console.log(`  Saved ${clip.id} (${(buffer.length / 1024).toFixed(1)}KB)`);
}

async function main() {
  console.log("ETF IQ Voiceover Generator");
  console.log("=".repeat(40));

  if (!ELEVENLABS_API_KEY) {
    console.error("\nERROR: Set ELEVENLABS_API_KEY environment variable");
    console.error("  export ELEVENLABS_API_KEY=your_key_here");
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  console.log(`\nGenerating ${VOICEOVER_CLIPS.length} clips...\n`);

  for (const clip of VOICEOVER_CLIPS) {
    try {
      await generateClip(clip);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`  FAILED: ${clip.id} - ${err}`);
    }
  }

  console.log("\nDone!");
}

main();
