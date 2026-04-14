import { NextResponse } from "next/server";
import { scrape } from "@/lib/scraper";

let progress = {
  running: false,
  total: 0,
  done: 0,
  message: "",
};

export async function GET() {
  return NextResponse.json(progress);
}

export async function POST(request: Request) {
  if (progress.running) {
    return NextResponse.json({ error: "Scrape already running" }, { status: 409 });
  }

  const body = await request.json();
  const days = typeof body.days === "number" ? body.days : 7;

  progress = { running: true, total: 0, done: 0, message: "Starting..." };

  // Run scrape in background (don't await)
  scrape(days, (done, total, message) => {
    progress = { running: true, total, done, message };
  })
    .then((count) => {
      progress = { running: false, total: count, done: count, message: `Done. ${count} posts upserted.` };
    })
    .catch((err) => {
      progress = { running: false, total: 0, done: 0, message: `Error: ${err.message}` };
    });

  return NextResponse.json({ started: true });
}
