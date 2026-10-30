import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const text = url.searchParams.get("text")?.trim();
  const langParam = url.searchParams.get("lang") || "hi";
  const lang = langParam.startsWith("en") ? "en" : "hi";

  if (!text) {
    return new NextResponse("Text query param is required", { status: 400 });
  }

  try {
    // Break into natural chunks of <= 150 chars by punctuation/words
    const chunks: string[] = [];
    const sentences = text.split(/([।!?.,\n]+)/);
    let currentChunk = "";

    for (const part of sentences) {
      if ((currentChunk + " " + part).length > 150) {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        currentChunk = part;
      } else {
        currentChunk += (currentChunk ? " " : "") + part;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    // If no punctuation, split by words
    if (chunks.length === 0) {
      const words = text.split(" ");
      let cur = "";
      for (const w of words) {
        if ((cur + " " + w).length > 150) {
          chunks.push(cur.trim());
          cur = w;
        } else {
          cur += (cur ? " " : "") + w;
        }
      }
      if (cur.trim()) chunks.push(cur.trim());
    }

    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk
      )}&tl=${lang}&client=tw-ob`;

      const res = await fetch(ttsUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        const ab = await res.arrayBuffer();
        buffers.push(Buffer.from(ab));
      }
    }

    if (buffers.length === 0) {
      return new NextResponse("Failed to synthesize speech", { status: 502 });
    }

    const combinedBuffer = Buffer.concat(buffers);

    return new NextResponse(combinedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Length": combinedBuffer.length.toString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "TTS error";
    return new NextResponse(msg, { status: 500 });
  }
}
