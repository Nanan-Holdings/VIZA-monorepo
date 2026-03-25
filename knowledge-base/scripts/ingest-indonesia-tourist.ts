/**
 * Indonesia B211A Tourist Visa Knowledge Base Ingest Script
 *
 * Scrapes Indonesian tourist visa requirements and ingests them into the
 * visa_chunks table with OpenAI text-embedding-3-small embeddings.
 *
 * Usage:
 *   cd knowledge-base && npx ts-node scripts/ingest-indonesia-tourist.ts
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import * as https from "https";
import * as http from "http";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

dotenv.config({ path: "../.env" });
dotenv.config({ path: ".env" });

// =============================================================================
// Config
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const COUNTRY = "indonesia";
const VISA_TYPE = "tourist_b211a";
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHUNK_SIZE_TOKENS = 500; // approximate, using character count (~4 chars/token)
const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * 4;

// =============================================================================
// Hardcoded fallback dataset (used if scraping fails)
// =============================================================================

interface FallbackDocument {
  title: string;
  document_type: string;
  content: string;
}

const FALLBACK_DOCUMENTS: FallbackDocument[] = [
  {
    title: "Indonesia B211A Tourist Visa - Required Documents",
    document_type: "requirements",
    content: `Indonesia B211A Tourist Visa Required Documents

The following documents are required for the Indonesia B211A Tourist Visa (e-Visa):

1. PASSPORT COPY
   - Clear color scan or photo of the bio-data page (photo page) of your passport
   - Passport must be valid for at least 6 months beyond your intended stay
   - All information must be clearly legible

2. PASSPORT PHOTO
   - Recent photograph (taken within 6 months)
   - White or light-colored background
   - Facing front, eyes open
   - No glasses, hats, or headwear (unless for religious purposes)
   - Size: 4cm x 6cm or as specified
   - High resolution JPEG or PNG format

3. FLIGHT BOOKING
   - Confirmed return flight booking showing arrival and departure dates
   - Must show passenger name matching passport
   - Flights to and from Indonesia

4. HOTEL BOOKING / ACCOMMODATION PROOF
   - Hotel booking confirmation for the duration of stay
   - Must include check-in and check-out dates
   - Must match the travel dates on flight booking
   - Alternative: Invitation letter from Indonesian host with their ID

5. TRAVEL ITINERARY
   - Day-by-day travel plan showing activities and locations in Indonesia
   - Must cover the entire duration of stay
   - Include cities, accommodation, and activities planned

6. BANK STATEMENT
   - Bank statement from the last 3 months
   - Must show sufficient funds for the trip (minimum USD 1,500 equivalent recommended)
   - Must be stamped or officially issued by your bank
   - Shows account holder name matching passport`,
  },
  {
    title: "Indonesia B211A Tourist Visa - Application Process",
    document_type: "process",
    content: `Indonesia B211A Tourist Visa Application Process

OVERVIEW
The Indonesia B211A is a tourist visa (Visit Visa) that allows visitors to stay in Indonesia for tourism, social, or cultural purposes.

ONLINE APPLICATION PORTAL
- Apply through the official Indonesia e-Visa portal: evisa.imigrasi.go.id
- Create an account with your email address
- Complete the online application form

APPLICATION STEPS

Step 1: Create Account
- Go to evisa.imigrasi.go.id
- Register with email and password
- Verify your email address

Step 2: Start New Application
- Select "B211A Tourist Visa"
- Select Indonesia as destination country

Step 3: Fill Personal Information
- Full name as shown in passport
- Date of birth
- Nationality
- Passport number, issue date, and expiry date
- Port of entry to Indonesia (e.g., Soekarno-Hatta Airport, Ngurah Rai Airport)

Step 4: Fill Travel Information
- Intended arrival date
- Intended departure date
- Duration of stay (maximum 60 days)
- Purpose of visit
- Accommodation details in Indonesia

Step 5: Upload Documents
- Upload all required documents (passport copy, photo, flight booking, hotel booking, travel itinerary, bank statement)
- Files must be in PDF, JPG, or PNG format
- Maximum file size: 1 MB per document

Step 6: Review and Submit
- Review all information carefully
- Pay the visa fee online (credit/debit card or e-wallet)
- Submit the application

Step 7: Wait for Processing
- Standard processing: 3-5 business days
- The visa approval will be sent to your registered email

VISA ON ARRIVAL (VoA) ALTERNATIVE
- Available for citizens of many countries at major Indonesian entry points
- USD 35 fee payable on arrival
- 30-day stay with one extension option for 30 more days
- Less documentation required`,
  },
  {
    title: "Indonesia B211A Tourist Visa - Fees and Duration",
    document_type: "requirements",
    content: `Indonesia B211A Tourist Visa Fees and Duration

VISA DURATION AND VALIDITY
- Stay duration: 60 days (extendable)
- Multiple entry: Available as multiple-entry visa
- Extension: Can be extended up to 4 times for 30 days each (maximum 6 months total stay)
- Must exit Indonesia before visa expiry

VISA FEES
- Single Entry: USD 50-100 (varies, check current rates on evisa.imigrasi.go.id)
- Multiple Entry: USD 150+ (check current rates)
- Processing fee: Included in visa fee
- Extension fee: Approximately IDR 500,000 per extension (payable in Indonesia)

PROCESSING TIME
- Standard processing: 3-5 business days
- Express processing: 1-2 business days (if available, higher fee)
- Apply at least 2 weeks before your intended travel date

VALIDITY PERIOD
- The visa is valid from the date of issue
- First entry must be within 90 days of visa approval
- Stay duration begins from date of first entry into Indonesia

ENTRY REQUIREMENTS
- Valid passport (6+ months validity beyond stay)
- Completed arrival/departure card (given on plane or at immigration)
- Proof of onward/return travel
- Sufficient funds for the duration of stay
- Accommodation address in Indonesia`,
  },
  {
    title: "Indonesia B211A Tourist Visa - FAQ",
    document_type: "faq",
    content: `Indonesia B211A Tourist Visa - Frequently Asked Questions

Q: What is the B211A visa?
A: The B211A is Indonesia's tourist visa (Visa Kunjungan Wisata), allowing entry for tourism, leisure, and social visits. It can be obtained online through evisa.imigrasi.go.id.

Q: Who needs a visa for Indonesia?
A: Citizens of most countries need a visa. Some countries have visa-free access for up to 30 days. Check the current list on the Indonesian Directorate General of Immigration website.

Q: How long can I stay on a B211A visa?
A: The initial stay is 60 days. You can extend up to 4 times, each for 30 days, for a maximum total stay of approximately 6 months.

Q: Can I work on a B211A visa?
A: No. The B211A is strictly for tourism and social activities. Working or conducting business activities is not permitted and requires a separate work visa.

Q: What is the difference between B211A (e-Visa) and Visa on Arrival?
A: Both allow tourism. The e-Visa (B211A) is applied for online before travel and gives 60 days. Visa on Arrival is obtained at the airport, costs USD 35, and gives 30 days (extendable once for 30 more days).

Q: My passport expires in 5 months. Can I still apply?
A: No. Your passport must be valid for at least 6 months beyond your intended stay in Indonesia. You need to renew your passport first.

Q: Can I extend my B211A visa while in Indonesia?
A: Yes. Visit the local Immigration Office (Kantor Imigrasi) in Indonesia before your visa expires. You'll need to pay an extension fee and provide documentation.

Q: What if my documents are rejected?
A: You'll be notified via email with the reason for rejection. You can re-upload the correct documents and resubmit.

Q: Is travel insurance required?
A: Not mandatory for the B211A, but strongly recommended. Some applications may request proof of insurance.

Q: Can I enter multiple times on one visa?
A: Depends on the visa type. Request a multiple-entry B211A if you plan to leave and re-enter Indonesia during your trip.`,
  },
  {
    title: "Indonesia B211A Tourist Visa - Common Mistakes to Avoid",
    document_type: "common_mistakes",
    content: `Common Mistakes to Avoid in Indonesia B211A Visa Application

1. PASSPORT VALIDITY
   - MISTAKE: Applying with a passport that expires within 6 months of return date
   - SOLUTION: Ensure passport is valid for at least 6 months beyond your last day in Indonesia

2. DOCUMENT QUALITY
   - MISTAKE: Submitting blurry, dark, or partially cropped document scans
   - SOLUTION: Use a scanner or take well-lit photos in good lighting. All text must be clearly readable

3. NAME MISMATCH
   - MISTAKE: Name on flight/hotel bookings doesn't exactly match passport name
   - SOLUTION: Use your full name as it appears in your passport for ALL bookings

4. DATE INCONSISTENCIES
   - MISTAKE: Flight dates, hotel dates, and stated travel dates don't match
   - SOLUTION: Ensure all dates are consistent across all documents

5. UNCONFIRMED BOOKINGS
   - MISTAKE: Submitting hotel reservation requests instead of confirmed bookings
   - SOLUTION: Submit only confirmed bookings with booking reference numbers

6. INSUFFICIENT BANK BALANCE
   - MISTAKE: Bank statement shows insufficient funds
   - SOLUTION: Maintain a minimum equivalent of USD 1,500 in your account

7. OLD BANK STATEMENT
   - MISTAKE: Submitting a bank statement older than 3 months
   - SOLUTION: Request a fresh statement dated within the last 3 months

8. INCOMPLETE ITINERARY
   - MISTAKE: Only listing flights without day-by-day plan
   - SOLUTION: Provide a detailed itinerary covering every day of your planned stay

9. WRONG PHOTO FORMAT
   - MISTAKE: Submitting photos with dark backgrounds or wearing sunglasses
   - SOLUTION: White/light background, no accessories, facing front, eyes open

10. APPLYING TOO LATE
    - MISTAKE: Applying less than a week before travel
    - SOLUTION: Apply at least 2 weeks in advance to allow for processing and potential resubmission`,
  },
  {
    title: "Indonesia B211A Tourist Visa - Application Form Fields",
    document_type: "form_fields",
    content: `Indonesia B211A Visa Application Form Fields Reference

PERSONAL INFORMATION SECTION
- Full Name: As it appears in passport (first name, middle name if any, last name)
- Date of Birth: DD/MM/YYYY format
- Place of Birth: City and country of birth
- Gender: Male/Female
- Nationality: Your citizenship country
- Occupation: Job title or profession
- Marital Status: Single/Married/Divorced/Widowed
- Religion: Optional in some cases

PASSPORT INFORMATION SECTION
- Passport Number: Exactly as shown on bio-data page
- Passport Issue Date: Date passport was issued
- Passport Expiry Date: Expiry date (must be 6+ months from return date)
- Issuing Country: Country that issued your passport
- Issuing Authority: Government office that issued the passport

CONTACT INFORMATION SECTION
- Email Address: Valid email (used for visa approval notification)
- Phone Number: Including country code
- Home Address: Full address in your home country

TRAVEL INFORMATION SECTION
- Port of Entry: Where you plan to enter Indonesia
  Common options: Soekarno-Hatta International Airport (Jakarta), Ngurah Rai International Airport (Bali), Juanda International Airport (Surabaya)
- Intended Arrival Date: First day in Indonesia
- Intended Departure Date: Last day in Indonesia
- Duration of Stay: Number of days
- Purpose of Visit: Tourism/Leisure/Visiting Family/Social/Cultural
- Accommodation Name: Hotel or host name
- Accommodation Address: Full address in Indonesia

REFERENCE IN INDONESIA (if applicable)
- Name of Reference: Person you're visiting
- Address: Their address in Indonesia
- Phone: Their contact number
- Relationship: How you know them`,
  },
];

// =============================================================================
// HTTP fetch helper (no external fetch dependency)
// =============================================================================

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const req = protocol.get(url, { headers: { "User-Agent": "Mozilla/5.0 VIZA-Ingest/1.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Request timeout")); });
  });
}

// =============================================================================
// Text extraction helpers
// =============================================================================

function extractTextFromHtml(html: string): string {
  // Simple regex-based text extraction (no cheerio dependency needed)
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If no paragraph splits found, split by size
  if (chunks.length === 0 && text.trim()) {
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize).trim());
    }
  }

  return chunks.filter((c) => c.length > 50);
}

// =============================================================================
// Scraping functions
// =============================================================================

interface ScrapedDocument {
  title: string;
  document_type: string;
  content: string;
  source_url: string;
}

async function scrapeEvisaPortal(): Promise<ScrapedDocument[]> {
  const docs: ScrapedDocument[] = [];

  const targetUrls = [
    { url: "https://evisa.imigrasi.go.id", document_type: "process" },
    { url: "https://www.imigrasi.go.id/en/visa", document_type: "requirements" },
  ];

  for (const target of targetUrls) {
    try {
      console.log(`  Fetching ${target.url}...`);
      const html = await fetchUrl(target.url);
      const text = extractTextFromHtml(html);

      if (text.length > 200) {
        docs.push({
          title: `Indonesia Immigration - ${target.document_type}`,
          document_type: target.document_type,
          content: text.slice(0, 10000), // cap to 10K chars per page
          source_url: target.url,
        });
        console.log(`  ✓ Fetched ${text.length} chars from ${target.url}`);
      }
    } catch (err) {
      console.log(`  ⚠ Could not fetch ${target.url}: ${(err as Error).message}`);
    }
  }

  return docs;
}

// =============================================================================
// Embedding function
// =============================================================================

async function embedText(openai: OpenAI, text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

// =============================================================================
// Main ingest function
// =============================================================================

async function ingest() {
  console.log("🚀 VIZA Knowledge Base Ingest - Indonesia B211A");
  console.log("=".repeat(50));

  // Validate env vars
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    console.error("❌ Missing required environment variables:");
    if (!SUPABASE_URL) console.error("  - SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
    if (!OPENAI_API_KEY) console.error("  - OPENAI_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Step 1: Delete existing chunks for indonesia/tourist_b211a (idempotent)
  console.log("\n📦 Step 1: Clearing existing chunks...");
  const { error: deleteChunksError } = await supabase
    .from("visa_chunks")
    .delete()
    .eq("country", COUNTRY)
    .eq("visa_type", VISA_TYPE);

  if (deleteChunksError) {
    console.error("❌ Failed to delete existing chunks:", deleteChunksError.message);
    process.exit(1);
  }

  const { error: deleteDocsError } = await supabase
    .from("visa_documents")
    .delete()
    .eq("country", COUNTRY)
    .eq("visa_type", VISA_TYPE);

  if (deleteDocsError) {
    console.error("❌ Failed to delete existing documents:", deleteDocsError.message);
    process.exit(1);
  }
  console.log("  ✓ Cleared existing data");

  // Step 2: Try scraping - fall back to hardcoded data
  console.log("\n🌐 Step 2: Fetching content...");
  let scrapedDocs: ScrapedDocument[] = [];

  try {
    scrapedDocs = await scrapeEvisaPortal();
  } catch (err) {
    console.log(`  ⚠ Scraping failed: ${(err as Error).message}. Using fallback data.`);
  }

  // Use fallback documents (always include them as they're comprehensive)
  const allDocuments: ScrapedDocument[] = [
    ...FALLBACK_DOCUMENTS.map((d) => ({ ...d, source_url: "internal://fallback" })),
    ...scrapedDocs,
  ];

  console.log(`  ✓ ${allDocuments.length} documents to process`);

  // Step 3: Insert documents and chunks with embeddings
  console.log("\n🔢 Step 3: Generating embeddings and inserting chunks...");

  let totalChunks = 0;
  let totalErrors = 0;

  for (const doc of allDocuments) {
    console.log(`\n  📄 Processing: ${doc.title}`);

    // Insert visa_document record
    const { data: visaDoc, error: docError } = await supabase
      .from("visa_documents")
      .insert({
        country: COUNTRY,
        visa_type: VISA_TYPE,
        document_type: doc.document_type,
        title: doc.title,
        source_url: doc.source_url,
        content: doc.content,
      })
      .select("id")
      .single();

    if (docError || !visaDoc) {
      console.error(`  ❌ Failed to insert document: ${docError?.message}`);
      totalErrors++;
      continue;
    }

    // Chunk the content
    const chunks = chunkText(doc.content, CHUNK_SIZE_CHARS);
    console.log(`     ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];

      try {
        // Generate embedding
        const embedding = await embedText(openai, chunkText);

        // Insert chunk
        const { error: chunkError } = await supabase.from("visa_chunks").insert({
          document_id: visaDoc.id,
          country: COUNTRY,
          visa_type: VISA_TYPE,
          document_type: doc.document_type,
          chunk_index: i,
          content: chunkText,
          embedding,
        });

        if (chunkError) {
          console.error(`  ❌ Failed to insert chunk ${i}: ${chunkError.message}`);
          totalErrors++;
        } else {
          totalChunks++;
          process.stdout.write(".");
        }

        // Rate limit: 10ms between embeddings
        await new Promise((r) => setTimeout(r, 10));
      } catch (err) {
        console.error(`  ❌ Embedding error for chunk ${i}: ${(err as Error).message}`);
        totalErrors++;
      }
    }
    console.log("");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`✅ Ingest complete!`);
  console.log(`   Documents processed: ${allDocuments.length}`);
  console.log(`   Chunks inserted: ${totalChunks}`);
  if (totalErrors > 0) {
    console.log(`   Errors: ${totalErrors}`);
  }
  console.log("\nNote: Ensure the search_visa_knowledge RPC function is created in Supabase.");
  console.log("See: viza-be/agent-backend/src/agent/domains/knowledge/visa-knowledge.service.ts");
}

ingest().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
