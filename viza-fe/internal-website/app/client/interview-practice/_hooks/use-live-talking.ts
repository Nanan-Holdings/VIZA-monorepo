"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveTalkingStatus = "idle" | "connecting" | "connected" | "unavailable";

type OfferResponse = RTCSessionDescriptionInit & {
  sessionid?: string;
  code?: number;
  msg?: string;
};

function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(done, 5000);
    function done() {
      window.clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    }
    function check() {
      if (pc.iceGatheringState === "complete") done();
    }
    pc.addEventListener("icegatheringstatechange", check);
  });
}

export function useLiveTalking(avatarId?: string, voice?: string) {
  const [status, setStatus] = useState<LiveTalkingStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const eventsRef = useRef<EventSource | null>(null);
  const connectingRef = useRef(false);

  const disconnect = useCallback(() => {
    eventsRef.current?.close();
    eventsRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    sessionIdRef.current = null;
    connectingRef.current = false;
    setStream(null);
    setIsSpeaking(false);
    setStatus("idle");
  }, []);

  const connect = useCallback(async () => {
    if (connectingRef.current || pcRef.current?.connectionState === "connected") return;
    connectingRef.current = true;
    setStatus("connecting");

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addEventListener("track", (event) => {
        const incoming = event.streams[0];
        if (incoming) setStream(incoming);
      });
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "connected") setStatus("connected");
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          setStatus("unavailable");
          setStream(null);
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const response = await fetch("/api/interview/avatar/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
          avatar: avatarId || process.env.NEXT_PUBLIC_LIVETALKING_AVATAR_ID || undefined,
          refaudio: voice || process.env.NEXT_PUBLIC_LIVETALKING_VOICE || undefined,
        }),
      });
      if (!response.ok) throw new Error("LiveTalking unavailable");
      const answer = (await response.json()) as OfferResponse;
      if (!answer.sdp || answer.code) throw new Error(answer.msg || "Invalid LiveTalking answer");

      sessionIdRef.current = answer.sessionid ?? null;
      await pc.setRemoteDescription({ type: answer.type, sdp: answer.sdp });

      if (answer.sessionid) {
        const events = new EventSource(`/api/interview/avatar/sse?sessionid=${encodeURIComponent(answer.sessionid)}`);
        events.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as { status?: string; data?: { status?: string } };
            const eventStatus = payload.status ?? payload.data?.status;
            if (["start", "speaking", "talking"].includes(eventStatus ?? "")) setIsSpeaking(true);
            if (["end", "stop", "idle"].includes(eventStatus ?? "")) setIsSpeaking(false);
          } catch { /* Ignore non-status events. */ }
        };
        eventsRef.current = events;
      }
    } catch {
      pcRef.current?.close();
      pcRef.current = null;
      setStream(null);
      setStatus("unavailable");
    } finally {
      connectingRef.current = false;
    }
  }, [avatarId, voice]);

  const speak = useCallback(async (text: string) => {
    const sessionid = sessionIdRef.current;
    if (!sessionid || status !== "connected") return false;
    setIsSpeaking(true);
    try {
      const response = await fetch("/api/interview/avatar/human", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionid,
          text,
          type: "echo",
          interrupt: true,
          ...(voice ? { tts: { voice } } : {}),
        }),
      });
      if (!response.ok) throw new Error("Avatar speech failed");
      return true;
    } catch {
      setIsSpeaking(false);
      return false;
    }
  }, [status, voice]);

  const interrupt = useCallback(async () => {
    const sessionid = sessionIdRef.current;
    setIsSpeaking(false);
    if (!sessionid) return;
    try {
      await fetch("/api/interview/avatar/interrupt_talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionid }),
      });
    } catch { /* The local interview can continue without the avatar. */ }
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return { status, stream, isSpeaking, connect, disconnect, speak, interrupt };
}
