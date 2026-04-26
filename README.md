# Overwatch Coach

**Live:** https://hfoster1.github.io/overwatch-coach/

Stat-based coaching tool for Overwatch 2 competitive play. Enter a BattleTag, pick a queue, and get role-specific advice driven by a rules engine tuned to your rank.

## Features

- Pulls live competitive stats via the [OverFast API](https://overfast-api.tekrop.fr/)
- Coaching advice for Tank, DPS, Support, and Open Queue
- Per-hero breakdown for your top 3 most-played heroes
- Hero win rate highlights across all seasons
- Rules engine in `src/ow2_coaching_rules.json` — fully editable

## Stack

- React + Vite
- Cloudflare Worker (CORS proxy to OverFast API)
- GitHub Pages

## Running locally

```bash
npm install
npm run dev
```

Requires your career profile to be set to **Public** in Overwatch: Options → Social → Career Profile Visibility.

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via the Actions workflow in `.github/workflows/deploy.yml`.
