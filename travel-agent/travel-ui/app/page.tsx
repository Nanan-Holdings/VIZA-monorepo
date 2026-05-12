"use client";

import { FormEvent, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";

import Map from "./components/Map";

type PlannerMode = "chat" | "form";

type ItineraryDay = {
  day: number | string;
  city: string;
  activities: string[];
  food: string[];
  cost: string;
};

type CityDays = Record<string, number>;

const BACKEND_URL = "http://127.0.0.1:8000";

const countryCityOptions: Record<string, string[]> = {
  Japan: ["Tokyo", "Osaka", "Kyoto"],
  France: ["Paris", "Lyon"],
};

function extractMessageText(message: {
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }

  return (
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

function parseItinerary(text: string): ItineraryDay[] {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  if (!cleaned) return [];

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;

        return {
          day: (record.day as number | string) ?? "-",
          city: typeof record.city === "string" ? record.city : "",
          activities: Array.isArray(record.activities)
            ? record.activities.map((value) => String(value))
            : [],
          food: Array.isArray(record.food) ? record.food.map((value) => String(value)) : [],
          cost: typeof record.cost === "string" ? record.cost : "N/A",
        } satisfies ItineraryDay;
      })
      .filter((day): day is ItineraryDay => Boolean(day && day.city));
  } catch {
    return [];
  }
}

export default function Home() {
  const [mode, setMode] = useState<PlannerMode>("chat");

  const [country, setCountry] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [cityDays, setCityDays] = useState<CityDays>({});
  const [travelers, setTravelers] = useState(1);
  const [budget, setBudget] = useState(1000);

  const [result, setResult] = useState<ItineraryDay[]>([]);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [downloading, setDownloading] = useState<"word" | "pdf" | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/chat",
    }),
    onFinish: ({ message }) => {
      const text = extractMessageText(message);
      const itinerary = parseItinerary(text);
      if (itinerary.length === 0) return;

      setResult(itinerary);
      const itineraryCities = [...new Set(itinerary.map((day) => day.city))];
      setCities(itineraryCities);
      setActiveCity(itineraryCities[0] ?? null);
    },
  });

  const chatLoading = status === "submitted" || status === "streaming";

  const cityOptions = useMemo(() => countryCityOptions[country] ?? [], [country]);

  const payload = useMemo(
    () => ({
      country,
      cities,
      city_days: cityDays,
      travelers,
      budget,
    }),
    [budget, cities, cityDays, country, travelers]
  );

  const toggleCity = (city: string) => {
    setCities((prev) => {
      if (prev.includes(city)) {
        const nextCities = prev.filter((item) => item !== city);
        setCityDays((prevDays) => {
          const nextDays = { ...prevDays };
          delete nextDays[city];
          return nextDays;
        });
        return nextCities;
      }

      setCityDays((prevDays) => ({
        ...prevDays,
        [city]: prevDays[city] ?? 1,
      }));
      return [...prev, city];
    });
  };

  const generatePlan = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { reply?: ItineraryDay[] };
      const itinerary = Array.isArray(data.reply) ? data.reply : [];
      setResult(itinerary);
      setActiveCity(itinerary[0]?.city ?? null);
    } finally {
      setLoading(false);
    }
  };

  const downloadItinerary = async (kind: "word" | "pdf") => {
    setDownloading(kind);
    const endpoint = kind === "word" ? "/download-word" : "/download-pdf";
    const filename = kind === "word" ? "travel_plan.docx" : "travel_plan.pdf";

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const onChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = chatInput.trim();
    if (!input) return;

    sendMessage({ text: input });
    setChatInput("");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <h1 className="text-center text-3xl font-bold">AI Travel Planner</h1>

        <div className="flex gap-2 rounded-lg bg-white p-2 shadow">
          <button
            onClick={() => setMode("chat")}
            className={`w-full rounded px-4 py-2 text-sm font-medium ${
              mode === "chat" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Chat Planner
          </button>
          <button
            onClick={() => setMode("form")}
            className={`w-full rounded px-4 py-2 text-sm font-medium ${
              mode === "form" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Structured Form
          </button>
        </div>

        {mode === "chat" ? (
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="mb-3 h-[360px] space-y-3 overflow-y-auto rounded border bg-gray-50 p-3">
              {messages.length === 0 ? (
                <div className="max-w-[80%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">
                  你好，我会一步一步问你国家、城市、天数、人数和预算，最后输出结构化 JSON 行程。
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "ml-auto bg-gray-800 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans">
                      {extractMessageText(message) || "..."}
                    </pre>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={onChatSubmit} className="flex gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="输入你的回答..."
                className="w-full rounded border p-2"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60"
              >
                {chatLoading ? "发送中..." : "发送"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg bg-white p-6 shadow">
            <select
              value={country}
              className="w-full rounded border p-2"
              onChange={(event) => {
                setCountry(event.target.value);
                setCities([]);
                setCityDays({});
              }}
            >
              <option value="">选择国家</option>
              {Object.keys(countryCityOptions).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              {cityOptions.map((city) => (
                <button
                  type="button"
                  key={city}
                  onClick={() => toggleCity(city)}
                  className={`rounded border px-3 py-1 ${
                    cities.includes(city) ? "bg-blue-600 text-white" : "bg-gray-200"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>

            {cities.map((city) => (
              <div key={city} className="flex items-center gap-3">
                <label className="w-28 text-sm text-gray-700">{city} days</label>
                <input
                  type="number"
                  min={1}
                  value={cityDays[city] ?? 1}
                  onChange={(event) =>
                    setCityDays((prev) => ({
                      ...prev,
                      [city]: Math.max(1, Number(event.target.value) || 1),
                    }))
                  }
                  className="w-full rounded border p-2"
                />
              </div>
            ))}

            <input
              type="number"
              min={1}
              value={travelers}
              onChange={(event) => setTravelers(Math.max(1, Number(event.target.value) || 1))}
              className="w-full rounded border p-2"
              placeholder="人数"
            />

            <input
              type="number"
              min={1}
              value={budget}
              onChange={(event) => setBudget(Math.max(1, Number(event.target.value) || 1))}
              className="w-full rounded border p-2"
              placeholder="预算（RMB）"
            />

            <div className="grid gap-2 md:grid-cols-2">
              <button
                onClick={generatePlan}
                className="rounded bg-green-600 px-4 py-2 text-white"
                type="button"
              >
                {loading ? "生成中..." : "生成行程"}
              </button>

              <button
                onClick={() => downloadItinerary("word")}
                className="rounded bg-slate-700 px-4 py-2 text-white"
                type="button"
                disabled={downloading !== null}
              >
                {downloading === "word" ? "导出中..." : "Download Word"}
              </button>

              <button
                onClick={() => downloadItinerary("pdf")}
                className="rounded bg-slate-700 px-4 py-2 text-white"
                type="button"
                disabled={downloading !== null}
              >
                {downloading === "pdf" ? "导出中..." : "Download PDF"}
              </button>
            </div>
          </div>
        )}

        <Map cities={cities} activeCity={activeCity} onCitySelect={setActiveCity} />

        {result.map((day) => (
          <div
            key={`${day.day}-${day.city}`}
            onClick={() => setActiveCity(day.city)}
            className={`cursor-pointer rounded border p-4 transition ${
              activeCity === day.city ? "bg-blue-100" : "bg-white"
            }`}
          >
            <h3 className="font-semibold">
              Day {day.day} - {day.city}
            </h3>
            <ul className="list-disc pl-5">
              {day.activities.map((activity, index) => (
                <li key={`${day.city}-${index}`}>{activity}</li>
              ))}
            </ul>
            <div className="mt-2 text-sm text-gray-700">Cost: {day.cost}</div>
          </div>
        ))}

        {result.length > 0 && mode === "chat" ? (
          <div className="grid gap-2 rounded-lg bg-white p-4 shadow md:grid-cols-2">
            <button
              onClick={() => downloadItinerary("word")}
              className="rounded bg-slate-700 px-4 py-2 text-white"
              type="button"
              disabled={downloading !== null}
            >
              {downloading === "word" ? "导出中..." : "Download Word"}
            </button>
            <button
              onClick={() => downloadItinerary("pdf")}
              className="rounded bg-slate-700 px-4 py-2 text-white"
              type="button"
              disabled={downloading !== null}
            >
              {downloading === "pdf" ? "导出中..." : "Download PDF"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
