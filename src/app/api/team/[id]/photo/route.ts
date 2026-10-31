import { getStoredPhoto } from "@/lib/server/team";

// GET /api/team/:id/photo - serves an uploaded team photo as an image (H8), so the /team page
// carries a small URL instead of ~30-300 KB of base64 in its HTML and RSC payload.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await getStoredPhoto(id).catch(() => null);
  const m = photo?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      // The URL carries a content hash (?v=), so it can be cached hard.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
