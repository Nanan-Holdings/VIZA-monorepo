import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  saveMarketingSocialComposition: vi.fn(),
  publishMarketingSocialComposition: vi.fn(),
  generateMarketingSocialComposition: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("@/app/actions/admin-marketing", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

import { SocialEditor } from "../social-editor";

const videoUrl = "https://example.supabase.co/storage/v1/object/public/marketing-public-assets/video/short.mp4";

afterEach(() => vi.clearAllMocks());

function renderShort(videoVisibility: "private" | "public" = "private") {
  return render(
    <SocialEditor
      locale="en"
      format="video"
      connectedPlatforms={["tiktok", "instagram", "youtube"]}
      openrouterConnected
      canPublish
      videoVisibility={videoVisibility}
      template={{
        blogPostId: "c77c2792-2cb1-4caa-8d83-f1eceb75adf0",
        title: "Short: ETIAS",
        brief: "ETIAS short",
        destinationUrl: "https://viza.it.com/blog/etias",
        videoUrl,
        platforms: ["tiktok", "instagram", "youtube"],
        platformContent: { tiktok: "ETIAS is not a visa. {url}", instagram: "ETIAS is not a visa. {url}", youtube: "ETIAS, explained. {url}" },
      }}
    />,
  );
}

describe("SocialEditor short mode", () => {
  it("offers only the video channels and video fields, with the private-mode warning", () => {
    renderShort();
    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(screen.getByText("Instagram Reels")).toBeInTheDocument();
    expect(screen.getByText("YouTube Shorts")).toBeInTheDocument();
    expect(screen.queryByText("Pinterest")).not.toBeInTheDocument();
    expect(screen.queryByText("Media URL")).not.toBeInTheDocument();
    expect(screen.getByText("YouTube title")).toBeInTheDocument();
    expect(screen.getByText(/Shorts post privately/)).toBeInTheDocument();
    expect(screen.getByText(/labelled as AI-generated/)).toBeInTheDocument();
    expect(screen.getByText(/Xiaohongshu is posted by hand/)).toBeInTheDocument();
  });

  it("saves the short with its language, title and a zoned schedule, then schedules it", async () => {
    actions.saveMarketingSocialComposition.mockResolvedValue({ success: true, data: { id: "6f1f8d7a-a3a7-437b-a029-1bb89ababb39" } });
    actions.publishMarketingSocialComposition.mockResolvedValue({ success: true, data: {} });
    const { container } = renderShort();
    fireEvent.change(container.querySelector('select[name="videoLocale"]')!, { target: { value: "zh-CN" } });
    fireEvent.change(container.querySelector('input[name="videoTitle"]')!, { target: { value: "ETIAS 30 秒看懂" } });
    fireEvent.change(container.querySelector('input[name="scheduledFor"]')!, { target: { value: "2026-12-01T18:00" } });
    fireEvent.change(container.querySelector('input[name="reason"]')!, { target: { value: "ETIAS short for the launch post" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & schedule" }));

    await waitFor(() => expect(actions.publishMarketingSocialComposition).toHaveBeenCalled());
    const saved = actions.saveMarketingSocialComposition.mock.calls[0][0];
    expect(saved).toMatchObject({
      blogPostId: "c77c2792-2cb1-4caa-8d83-f1eceb75adf0",
      videoUrl, videoLocale: "zh-CN", videoTitle: "ETIAS 30 秒看懂",
      mediaUrl: undefined, documentUrl: undefined,
      platforms: ["tiktok", "instagram", "youtube"],
      platformContent: { tiktok: "ETIAS is not a visa. {url}", instagram: "ETIAS is not a visa. {url}", youtube: "ETIAS, explained. {url}" },
      scheduledFor: new Date("2026-12-01T18:00").toISOString(),
    });
    expect(actions.publishMarketingSocialComposition).toHaveBeenCalledWith({ id: "6f1f8d7a-a3a7-437b-a029-1bb89ababb39", reason: "ETIAS short for the launch post" });
    expect(router.push).toHaveBeenCalledWith("/admin/marketing/social");
  });

  it("keeps a failed publish on the saved draft instead of creating a second one", async () => {
    actions.saveMarketingSocialComposition.mockResolvedValue({ success: true, data: { id: "6f1f8d7a-a3a7-437b-a029-1bb89ababb39" } });
    actions.publishMarketingSocialComposition.mockResolvedValue({ success: false, error: "tiktok is not connected to the configured Upload-Post profile" });
    const { container } = renderShort();
    fireEvent.change(container.querySelector('input[name="videoTitle"]')!, { target: { value: "ETIAS explained" } });
    fireEvent.change(container.querySelector('input[name="reason"]')!, { target: { value: "ETIAS short test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));
    expect(await screen.findByText("tiktok is not connected to the configured Upload-Post profile")).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith("/admin/marketing/social/6f1f8d7a-a3a7-437b-a029-1bb89ababb39");
  });
});
