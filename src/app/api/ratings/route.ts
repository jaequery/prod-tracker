import { prisma } from "@/lib/prisma";

export async function GET() {
  const ratings = await prisma.userRating.findMany({
    orderBy: { updatedAt: "desc" },
    select: { postId: true, value: true, reason: true },
  });
  return Response.json({ ratings });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const postId = Number(body?.postId);
  const value = Number(body?.value);
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!Number.isInteger(postId) || postId <= 0) {
    return Response.json({ error: "invalid postId" }, { status: 400 });
  }
  if (value !== 1 && value !== -1) {
    return Response.json({ error: "value must be 1 or -1" }, { status: 400 });
  }

  const rating = await prisma.userRating.upsert({
    where: { postId },
    create: { postId, value, reason },
    update: { value, reason },
    select: { postId: true, value: true, reason: true },
  });

  return Response.json({ rating });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const postId = Number(searchParams.get("postId"));

  if (!Number.isInteger(postId) || postId <= 0) {
    return Response.json({ error: "invalid postId" }, { status: 400 });
  }

  await prisma.userRating.deleteMany({ where: { postId } });
  return Response.json({ ok: true });
}
