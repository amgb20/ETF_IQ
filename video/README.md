# ETF IQ — Promo Video (Remotion)

Two promotional video compositions for the ETF IQ landing page.

## Compositions

| ID | Duration | Description |
|---|---|---|
| `ETFIQTeaser` | 30s | Punchy teaser: title, dashboard, Charles AI, agent pipeline, logo |
| `ETFIQFull` | 60s | Full demo: onboarding, dashboard, analysis, Charles, report generation (3D), light mode, logo |

## Quick Start

```bash
npm install
npx remotion studio   # Preview in browser
```

## Generate Voiceover (ElevenLabs)

```bash
export ELEVENLABS_API_KEY=your_key_here
# Optional: export ELEVENLABS_VOICE_ID=voice_id
npm run generate-voiceover
```

Audio clips are saved to `public/audio/clips/`. The compositions will play them automatically if present, and work silently if they're missing.

## Render

```bash
npm run render:teaser          # out/etf-iq-teaser.mp4
npm run render:full            # out/etf-iq-full.mp4
npm run render:teaser:webm     # out/etf-iq-teaser.webm
npm run render:full:webm       # out/etf-iq-full.webm
npm run render:all             # Both MP4s
```

## Architecture

```
src/
  Root.tsx                    Root with both compositions
  design-tokens.ts            Colors, fonts (from frontend/src/index.css)
  data/portfolio.ts           All demo data (consistent across scenes)
  components/                 Animation primitives (DesktopFrame, cursor, typewriter...)
  ui-replicas/                Faithful UI component replicas (inline styles, no Tailwind)
  scenes/teaser/              5 teaser scenes
  scenes/full/                8 full demo scenes
  three/                      Three.js agent dispatch 3D animation
  audio/                      ElevenLabs TTS scripts + AudioLayer component
```
