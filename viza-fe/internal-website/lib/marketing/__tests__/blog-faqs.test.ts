import { describe, expect, it } from "vitest";
import { mapBlogAdminRecord, mapBlogPost } from "../db";
import { cleanBlogFaqs, validateBlogDraft } from "../validation";

/* FAQs ride in the metadata JSONB beside topics rather than in a column of
   their own, so the round trip through the mappers is the thing worth
   pinning down. */
const row = {
  id: "8f1f5d1e-4b7a-4f3a-9a8e-2f2f9f0d5c11",
  locale: "en",
  slug: "sg-work-visa-routes-2026",
  status: "draft",
  title: "Singapore work visa routes",
  excerpt: "Excerpt",
  body_markdown: "Body",
  cover_image_url: null,
  category: null,
  author_name: "VIZA Editorial",
  seo_title: null,
  seo_description: null,
  generation_brief: null,
  generated_by_model: null,
  version: 1,
  published_at: null,
  created_at: "2026-09-22T00:00:00.000Z",
  updated_at: "2026-09-22T00:00:00.000Z",
  metadata: {
    faqs: [
      { question: " Who can apply? ", answer: " Anyone above the salary floor. " },
      { question: "Missing an answer", answer: "   " },
      { question: "", answer: "Missing a question" },
      "not an faq",
    ],
  },
};

describe("blog FAQs", () => {
  it("reads only complete pairs out of the metadata, trimmed", () => {
    expect(mapBlogAdminRecord(row).editorial.faqs).toEqual([
      { question: "Who can apply?", answer: "Anyone above the salary floor." },
    ]);
  });

  it("publishes them on the public post as well", () => {
    expect(mapBlogPost({ ...row, published_at: "2026-09-22T00:00:00.000Z" }).faqs).toEqual([
      { question: "Who can apply?", answer: "Anyone above the salary floor." },
    ]);
  });

  it("defaults to an empty list when the post predates the field", () => {
    expect(mapBlogAdminRecord({ ...row, metadata: {} }).editorial.faqs).toEqual([]);
    expect(mapBlogPost({ ...row, published_at: "2026-09-22T00:00:00.000Z", metadata: null }).faqs).toEqual([]);
  });

  it("drops half-typed rows instead of failing the save", () => {
    expect(cleanBlogFaqs([{ question: "Q", answer: "" }, { question: "", answer: "A" }])).toEqual([]);
  });

  it("caps the list at ten and each field at its limit", () => {
    const many = Array.from({ length: 14 }, (_, index) => ({ question: `Q${index}`, answer: "A".repeat(1_200) }));
    const cleaned = cleanBlogFaqs(many);
    expect(cleaned).toHaveLength(10);
    expect(cleaned[0].answer).toHaveLength(1_000);
  });

  it("carries them through a draft save", () => {
    const draft = validateBlogDraft({
      locale: "en",
      slug: "sg-work-visa-routes-2026",
      title: "Title",
      excerpt: "Excerpt",
      bodyMarkdown: "Body",
      authorName: "VIZA",
      reason: "Editorial update",
      faqs: [{ question: "Who can apply?", answer: "Anyone above the salary floor." }],
    });
    expect(draft.faqs).toEqual([{ question: "Who can apply?", answer: "Anyone above the salary floor." }]);
  });
});
