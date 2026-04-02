import axios from "axios";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Load environment variables from .env file (from knowledge-base root directory)
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Official immigration and VFS sources to filter
const APPROVED_SOURCES = [
  // === SOUTHEAST ASIA ===
  "imigrasi.go.id",
  "evisa.imigrasi.go.id",
  "ica.gov.sg",
  "imigresen.gov.my",
  "immigration.go.th",
  "oca.gov.ph",
  "mea.gov.in",

  // === EAST ASIA ===
  "immi-moj.go.jp",
  "immigration.go.kr",
  "nrcs.org.cn",
  "mpsb.gov.tw",

  // === OCEANIA ===
  "immi.homeaffairs.gov.au",
  "immigration.govt.nz",

  // === NORTH AMERICA ===
  "uscis.gov",
  "state.gov",
  "canada.ca",

  // === LATIN AMERICA ===
  "migraciones.gov.ar",
  "migracion.gob.mx",
  "gov.br",

  // === MIDDLE EAST & AFRICA ===
  "gdrfa.ae",
  "moi.gov.ae",
  "enjjaz.ae",
  "saudinow.com",

  // === EUROPEAN UNION (NON-SCHENGEN) ===
  "gov.uk",
  "ireland.ie",

  // === SCHENGEN AREA ===
  "france-visas.gouv.fr",
  "imigraci.de",
  "bamf.bund.de",
  "ind.nl",
  "ibz.rrn.fgov.be",
  "esteri.it",
  "consulado.es",
  "mzv.cz",
  "mswia.gov.pl",
  "slowakiavisas.sk",
  "minv.sk",
  "migration.gv.at",
  "gov.hu",
  "migrationsverket.se",
  "migri.fi",
  "newtodenmark.dk",
  "udi.no",
  "sef.pt",
  "migration.gov.gr",
  "gov.si",
  "mpl.gov.cy",
  "sem.admin.ch",
  "luxembourg.lu",
  "gouvernement.lu",

  // === VFS GLOBAL ===
  "vfsglobal.com",
  "vfs-india.in",
  "vfs-uk.com",
  "vfsindia.com",
  "vfsvisaonline.com",
  "visaservices.net",

  // === OTHER POPULAR DESTINATIONS ===
  "mymigration.gov.sg",
  "immigration.gov.my",
  "thaievisa.go.th",
  "mofa.go.kr",
  "embassy.org",
  "dfat.gov.au",
];

// Visa-related keywords for filtering
const VISA_KEYWORDS = [
  "visa",
  "immigration",
  "immigrant",
  "migrate",
  "emigrant",
  "permit",
  "work permit",
  "residence",
  "residency",
  "deportation",
  "asylum",
  "refugee",
  "border",
  "citizenship",
  "naturalization",
  "sponsorship",
  "green card",
  "passport",
  "travel ban",
  "travel restriction",
];

// === NEWS API CONFIGURATIONS ===
interface NewsAPI {
  name: string;
  fetch: () => Promise<any[]>;
}

const newsAPIs: NewsAPI[] = [
  {
    name: "NewsAPI",
    fetch: fetchFromNewsAPI,
  },
  {
    name: "Guardian API",
    fetch: fetchFromGuardianAPI,
  },
  {
    name: "MediaStack API",
    fetch: fetchFromMediaStackAPI,
  },
];

// === HELPER FUNCTIONS ===

// Check if article contains visa-related keywords
function containsVisaKeywords(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return VISA_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

// === NEWS API FUNCTIONS ===

async function fetchFromNewsAPI(): Promise<any[]> {
  const NEWS_API_KEY = process.env.NEWS_API_KEY;

  if (!NEWS_API_KEY) {
    console.error("❌ NEWS_API_KEY not found in .env");
    return [];
  }

  try {
    const endpoint = "https://newsapi.org/v2/everything";
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const fromDate = tenDaysAgo.toISOString().split("T")[0];

    const response = await axios.get(endpoint, {
      params: {
        q: "visa",
        language: "en",
        from: fromDate,
        sortBy: "publishedAt",
        pageSize: 100,
        apiKey: NEWS_API_KEY,
      },
    });

    return response.data.articles || [];
  } catch (error: any) {
    console.error("❌ NewsAPI error:", error.message);
    return [];
  }
}

// Fetch from Guardian API with pagination and advanced filters
async function fetchFromGuardianAPI(): Promise<any[]> {
  const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY;

  if (!GUARDIAN_API_KEY) {
    console.error("❌ GUARDIAN_API_KEY not found in .env");
    return [];
  }

  try {
    const endpoint = "https://content.guardianapis.com/search";
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const fromDate = tenDaysAgo.toISOString().split("T")[0];

    let allArticles: any[] = [];
    const maxPages = 3; // Fetch up to 3 pages for more comprehensive results

    // Pagination: loop through multiple pages
    for (let page = 1; page <= maxPages; page++) {
      try {
        const response = await axios.get(endpoint, {
          params: {
            // Simplified query: Guardian API supports basic AND/OR/NOT operators
            q: "visa AND immigration",
            "from-date": fromDate,
            "show-fields": "headline,bodyText,byline,lastModified",
            "order-by": "newest",
            "api-key": GUARDIAN_API_KEY,
            "page-size": 50,
            page: page,
          },
        });

        const results = response.data.response.results || [];
        if (results.length === 0) break; // Stop if no more results

        console.log(`   📄 Page ${page}: ${results.length} results`);

        // Transform and accumulate articles
        const transformedArticles = results.map((article: any) => ({
          title: article.webTitle,
          description:
            article.fields?.bodyText?.slice(0, 200) || "No description",
          source: {
            name: "The Guardian",
          },
          publishedAt: article.webPublicationDate,
          url: article.webUrl,
        }));

        allArticles = allArticles.concat(transformedArticles);
      } catch (pageError: any) {
        // Log page-specific error but continue fetching
        if (pageError.response?.status === 400) {
          console.log(`   ⚠️  Page ${page}: Query limit or invalid params`);
        } else {
          console.log(`   ⚠️  Page ${page}: ${pageError.message}`);
        }
        // Continue to next page instead of failing completely
        continue;
      }
    }

    console.log(`   ✅ Guardian API total: ${allArticles.length} articles\n`);
    return allArticles;
  } catch (error: any) {
    console.error("❌ Guardian API error:", error.message);
    return [];
  }
}

// Fetch from MediaStack API
async function fetchFromMediaStackAPI(): Promise<any[]> {
  const MEDIASTACK_API_KEY = process.env.MEDIASTACK_API_KEY;

  if (!MEDIASTACK_API_KEY) {
    console.error("❌ MEDIASTACK_API_KEY not found in .env");
    return [];
  }

  try {
    // Note: MediaStack free tier may not support HTTPS or have other limitations
    const endpoint = "http://api.mediastack.com/v1/news";
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const fromDate = tenDaysAgo.toISOString().split("T")[0];

    const response = await axios.get(endpoint, {
      params: {
        keywords: "visa",
        sort: "published_desc",
        languages: "en",
        limit: 50,
        access_key: MEDIASTACK_API_KEY,
        // Date filtering might not be available on free tier
        // date: fromDate,
      },
    });

    console.log(
      `   📄 MediaStack returned: ${response.data.data?.length || 0} articles`,
    );

    return (
      response.data.data?.map((article: any) => ({
        title: article.title || "No title",
        description: article.description || "No description",
        source: {
          name: article.source || "MediaStack",
        },
        publishedAt: article.published_at,
        url: article.url,
      })) || []
    );
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      console.error(
        "❌ MediaStack API error: Authentication failed - check API key",
      );
    } else if (status === 429) {
      console.error("❌ MediaStack API error: Rate limit exceeded (429)");
    } else {
      console.error("❌ MediaStack API error:", error.message);
    }
    return [];
  }
}


// =============================================================================
// SUPABASE + TELEGRAM PIPELINE (Option B)
// =============================================================================

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function insertKnowledgeBaseUpdates(articles: any[]): Promise<Map<string, string>> {
  const idMap = new Map<string, string>(); // url -> id
  const supabase = getSupabase();
  if (!supabase) {
    console.warn("⚠️  Supabase not configured, skipping knowledge_base_updates insert");
    return idMap;
  }

  const rows = articles.map((a: any) => ({
    article_url: a.url || "",
    headline: a.title || "",
    source: a.source?.name || a.source || "",
    published_at: a.publishedAt || null,
    status: "pending_review",
  }));

  const { data, error } = await supabase
    .from("knowledge_base_updates")
    .upsert(rows, { onConflict: "article_url", ignoreDuplicates: false })
    .select("id, article_url");

  if (error) {
    console.error("❌ Failed to insert knowledge_base_updates:", error.message);
    return idMap;
  }

  (data || []).forEach((row: any) => idMap.set(row.article_url, row.id));
  console.log(`✅ Inserted ${data?.length ?? 0} articles into knowledge_base_updates`);
  return idMap;
}

async function sendTelegramNotification(article: any, id: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1003767157934";

  if (!token || token === "your_telegram_bot_token_here") {
    console.warn(`⚠️  TELEGRAM_BOT_TOKEN not set, skipping notification for: ${article.title}`);
    return;
  }

  const text = [
    "🗞️ *New visa update detected*",
    "",
    `*Source:* ${escapeMarkdown(article.source?.name || article.source || "Unknown")}`,
    `*Headline:* ${escapeMarkdown(article.title || "")}`,
    "",
    article.url || "",
  ].join("\n");

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Approve Re-ingest", callback_data: `approve_${id}` },
        { text: "❌ Dismiss", callback_data: `dismiss_${id}` },
      ]],
    },
  };

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, payload);
    console.log(`📱 Telegram notification sent for: ${article.title}`);
  } catch (err: any) {
    console.error(`❌ Telegram send failed: ${err.message}`);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

async function runTelegramPipeline(articles: any[]): Promise<void> {
  if (articles.length === 0) return;

  console.log(`\n📡 Running Telegram pipeline for ${articles.length} articles...`);
  const idMap = await insertKnowledgeBaseUpdates(articles);

  for (const article of articles) {
    const id = idMap.get(article.url || "") || "unknown";
    await sendTelegramNotification(article, id);
  }
}

// === MAIN FUNCTION ===

async function monitorAllNews() {
  console.log("🚀 Starting multi-source visa & immigration news monitor...\n");

  // Collect all articles for file output
  const allCollectedArticles: any[] = [];
  const allRejectedArticles: any[] = [];

  for (const api of newsAPIs) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📡 Fetching from ${api.name}...`);
    console.log("=".repeat(60));

    try {
      const articles = await api.fetch();
      console.log(`📊 Total articles found: ${articles.length}`);

      // Filter by source - separate approved and filtered articles
      const filteredArticles: any[] = [];
      const rejectedArticles: any[] = [];
      let discardedCount = 0;

      articles.forEach((article: any) => {
        const sourceName = article.source.name
          .toLowerCase()
          .replace(/^www\./, "");
        const articleUrl = article.url?.toLowerCase() || "";

        const isApproved = APPROVED_SOURCES.some(
          (approvedSource) =>
            sourceName.includes(approvedSource) ||
            articleUrl.includes(approvedSource),
        );

        if (isApproved) {
          // Approved source - include regardless of content
          filteredArticles.push(article);
        } else {
          // Not from approved source - check if it contains visa-related keywords
          const hasVisaKeywords = containsVisaKeywords(
            article.title || "",
            article.description || "",
          );

          if (hasVisaKeywords) {
            // Include in rejected articles (other sources with visa keywords)
            rejectedArticles.push(article);
          } else {
            // No visa keywords - discard completely
            discardedCount++;
          }
        }
      });

      console.log(
        `🔍 Articles from approved sources: ${filteredArticles.length}`,
      );
      console.log(
        `📊 Articles from other sources (with visa keywords): ${rejectedArticles.length}`,
      );
      console.log(`🔕 Discarded (no visa keywords): ${discardedCount}\n`);

      if (filteredArticles.length === 0) {
        console.log(
          `ℹ️  No articles from official immigration or VFS sources.`,
        );
      } else {
        console.log(`✅ Approved sources (${filteredArticles.length}):\n`);

        // Display approved articles
        filteredArticles.forEach((article: any, index: number) => {
          const publishedDate = new Date(article.publishedAt).toLocaleString();
          console.log(`[${index + 1}] Title: ${article.title}`);
          console.log(`    Source: ${article.source.name}`);
          console.log(`    Published: ${publishedDate}`);
          console.log(`    Description: ${article.description}`);
          console.log(`    Link: ${article.url}\n`);
          console.log("-".repeat(60));
        });

        // Add to collection with API source info
        filteredArticles.forEach((article: any) => {
          allCollectedArticles.push({
            ...article,
            apiSource: api.name,
          });
        });
      }

      // Show summary of rejected articles (debug info)
      if (rejectedArticles.length > 0) {
        console.log(
          `\n📰 Other sources with visa-related keywords (${rejectedArticles.length}):\n`,
        );

        // Collect rejected articles (only titles) for file output
        rejectedArticles.forEach((article: any) => {
          allRejectedArticles.push({
            title: article.title,
            source: article.source.name,
            apiSource: api.name,
          });
        });

        // Group by source name for summary
        const sourceCount: { [key: string]: number } = {};
        rejectedArticles.forEach((article: any) => {
          const source = article.source.name;
          sourceCount[source] = (sourceCount[source] || 0) + 1;
        });

        // Display sources and their article counts
        Object.entries(sourceCount)
          .sort(([, a], [, b]) => b - a)
          .forEach(([source, count]) => {
            console.log(`   • ${source} (${count} articles)`);
          });

        console.log(
          `\n💡 Note: These are non-official sources with visa-related keywords. Check VISA_KEYWORDS array to customize filtering.\n`,
        );
      }
    } catch (error: any) {
      console.error(`❌ Error fetching from ${api.name}:`, error.message);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ News monitoring complete!");
  console.log("=".repeat(60));

  // === SAVE RESULTS TO FILE ===
  const filename = "visa-news.json";
  const filepath = path.resolve(__dirname, filename);

  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      approvedSourcesTotal: allCollectedArticles.length,
      otherSourcesTotal: allRejectedArticles.length,
    },
    approvedSources: allCollectedArticles,
    otherSources: allRejectedArticles,
  };

  try {
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n📁 Results saved to: ${filename} (overwrite mode)`);
    console.log(
      `   ✅ Approved sources: ${allCollectedArticles.length} articles`,
    );
    console.log(`   📰 Other sources: ${allRejectedArticles.length} titles`);
  } catch (error: any) {
    console.error(`❌ Error saving file: ${error.message}`);
  }

  // === TELEGRAM PIPELINE (Option B) ===
  // Insert approved articles into knowledge_base_updates + send Telegram notifications
  if (allCollectedArticles.length > 0) {
    await runTelegramPipeline(allCollectedArticles);
  }
}

// Execute
monitorAllNews();
