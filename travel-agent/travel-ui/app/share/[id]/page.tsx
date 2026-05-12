"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ItineraryDay = {
  day: number | string;
  city: string;
  activities: string[];
};

export default function SharePage() {
  const params = useParams();
  const [data, setData] = useState<ItineraryDay[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        `http://127.0.0.1:8000/share/${params.id}`
      );
      const result = (await res.json()) as { data?: ItineraryDay[] };
      setData(Array.isArray(result.data) ? result.data : []);
    };

    fetchData();
  }, [params.id]);

  return (
    <div className="p-10 max-w-3xl mx-auto space-y-4">

      <h1 className="text-2xl font-bold">分享的旅行行程</h1>

      {data.map((day) => (
        <div key={day.day} className="p-4 border rounded">
          <h3>Day {day.day} - {day.city}</h3>
          <ul>
            {day.activities.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ))}

    </div>
  );
}
