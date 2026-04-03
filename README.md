# WorldPuzzle

Landmark-themed puzzle content and a React Native (Expo) client.

## Repository layout

| Path | Purpose |
|------|---------|
| `puzzle_prompts/` | Per-landmark text prompts and `metadata.json` (continent, place, country). |
| `generate_prompts.py` | Generates prompt files for AI image workflows. |
| `mobile/` | Expo app (TypeScript, [NativeWind](https://www.nativewind.dev/) + Tailwind-style utilities). |

## Mobile app (`mobile/`)

Prerequisites: [Node.js](https://nodejs.org/) and the [Expo Go](https://expo.dev/go) app on a device (for quick testing).

```bash
cd mobile
npm install
npm start
```

- **Android / iOS simulators:** use the prompts in the terminal, or press `a` / `i`.
- **Web:** `npm run web`.
- **Physical device on another network or when LAN is unreliable:** tunnel mode clears cache and uses Expo’s tunnel (works well with Expo Go):

```bash
cd mobile
npx expo start -c --tunnel
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

If NativeWind styles look stale after config changes, keep using `-c` to clear the Metro cache.

## Puzzle prompt generator

```bash
python generate_prompts.py
```

Output is written under `puzzle_prompts/` (see the script for options and behavior).
