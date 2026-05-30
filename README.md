# Show HN Dashboard

A dashboard that tracks and analyzes Show HN posts from Hacker News. Each project is scored by AI across usefulness, competition, and revenue potential with a Rotten Tomatoes-style rating.

## Features

- Scrapes Show HN posts from the Hacker News Algolia API
- Optional Product Hunt integration: ingests Product Hunt launches via the Product Hunt API (set `PRODUCT_HUNT_TOKEN`); they are AI-scored and shown alongside Show HN with a source badge
- AI-powered project analysis via OpenRouter (Gemini 2.5 Flash Lite):
  - Overall interest score (0-100)
  - Target audience identification
  - Letter grades (A-F) for Usefulness, Competition, and Money potential
  - AI-generated project summary
- Monthly filtering with bar chart
- Sortable by AI score, upvotes, comments, or post time
- Dark mode support

## Setup

```bash
pnpm install
```

### Environment Variables

Create a `.env` file:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5407/prod_tracker"
OPENROUTER_API_KEY="your-openrouter-api-key"

# Optional — enables Product Hunt launch ingestion alongside Show HN.
# Create a developer token at https://www.producthunt.com/v2/oauth/applications
PRODUCT_HUNT_TOKEN="your-product-hunt-developer-token"
```

When `PRODUCT_HUNT_TOKEN` is set, the scheduled scrape and `npm run scrape:ph`
also pull Product Hunt launches into the same dashboard. Without the token,
Product Hunt ingestion is skipped and only Show HN is tracked.

### Database

```bash
npm run db:migrate
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (port 3107) |
| `npm run build` | Production build |
| `npm run scrape` | Scrape last 7 days |
| `npm run scrape:year` | Scrape last 365 days |
| `npm run scrape:ph` | Scrape last 7 days of Product Hunt launches (needs `PRODUCT_HUNT_TOKEN`) |
| `npm run db:migrate` | Run Prisma migrations |

The scraper fetches posts, then reviews unscored posts with AI (10 in parallel). Already-scored posts are skipped on re-runs.

## Tech Stack

- Next.js 16 + React 19
- PostgreSQL + Prisma 7
- Tailwind CSS 4
- OpenRouter API (Gemini 2.5 Flash Lite)
