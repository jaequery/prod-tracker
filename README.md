# Show HN Dashboard

A dashboard that tracks and analyzes Show HN posts from Hacker News. Each project is scored by AI across usefulness, competition, and revenue potential with a Rotten Tomatoes-style rating.

## Features

- Scrapes Show HN posts from the Hacker News Algolia API
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
```

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
| `npm run db:migrate` | Run Prisma migrations |

The scraper fetches posts, then reviews unscored posts with AI (10 in parallel). Already-scored posts are skipped on re-runs.

## Tech Stack

- Next.js 16 + React 19
- PostgreSQL + Prisma 7
- Tailwind CSS 4
- OpenRouter API (Gemini 2.5 Flash Lite)
