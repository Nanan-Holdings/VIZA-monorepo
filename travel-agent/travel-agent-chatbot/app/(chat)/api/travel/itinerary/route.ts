import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch("http://localhost:8000/generate-itinerary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const itinerary = await res.json();

    return NextResponse.json({
      role: "assistant",
      parts: [
        {
          type: "tool-itinerary",
          output: itinerary,
        },
      ],
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json({
      role: "assistant",
      parts: [
        {
          type: "tool-itinerary",
          output: [],
        },
      ],
    });
  }
}