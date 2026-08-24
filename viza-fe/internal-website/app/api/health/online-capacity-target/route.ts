import { readCapacityTargetMarker } from "./marker";

export async function GET() {
  const responseInit = {
    headers: { "Cache-Control": "no-store" },
  } as const;
  try {
    const marker = readCapacityTargetMarker();
    if (!marker) {
      return Response.json({ enabled: false }, { ...responseInit, status: 404 });
    }
    return Response.json(marker, {
      ...responseInit,
      status: 200,
    });
  } catch {
    return Response.json({ enabled: false }, { ...responseInit, status: 503 });
  }
}
