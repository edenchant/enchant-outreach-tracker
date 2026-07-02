# Enchant Outreach Tracker

A priority outreach queue for Enchant's influencer/partner contacts. Contacts are grouped into
**segments** (e.g. In-House), each with its own tier system (A–D) and outreach **stage pipeline**
(e.g. LinkedIn Add → First Reach → Second Reach → Third Reach). Every contact has a priority score
and a due date that update automatically as you work through the queue.

This started as a static HTML prototype and has been rebuilt into a real app: a Next.js server
backed by a local SQLite database, so "Mark contacted" actually persists, and the underlying
pipeline (tiers, stage cadence, priority weighting) is editable instead of hardcoded.

## Getting started

```bash
npm install
npm run seed   # one-time: creates the In-House segment and imports its 448 contacts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

- **Segments** are independent contact lists, each with their own tiers and stages. Create new
  ones from the "+ New segment" tab.
- **Tiers** (A–D by default) carry a priority weight.
- **Stages** form an ordered pipeline per segment. Each stage has a follow-up interval (days until
  the contact is due again after being actioned) and a priority weight.
- **Priority score** = `followers × tier weight × stage weight`. It's recalculated whenever a
  contact's followers, tier, or stage change, or when you retune weights in Settings.
- **Mark contacted** logs an outreach event, advances the contact to the next stage in the
  pipeline, and recomputes their due date and priority. A toast lets you undo the action.
- Per-segment pipeline settings (tier weights, stage names/intervals/weights) live at
  `/segments/<slug>/settings`.

## Data

Data lives in a local SQLite database at `data/app.db` (via Node's built-in `node:sqlite`), created
automatically on first run. It's gitignored — each environment has its own local database.

## Tech stack

Next.js (App Router) + TypeScript, `node:sqlite` for persistence (no external DB or native
bindings required), plain CSS matching the original prototype's design.
