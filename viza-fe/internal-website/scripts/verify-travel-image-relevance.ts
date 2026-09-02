import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";
import {
  getDropdownDestinationContracts,
  verifyTravelImageRelevance,
  type TravelDestinationAssetContract,
} from "../lib/travel/destination-contracts";

type ImageIssue = {
  severity: "error" | "warn";
  entity: string;
  imageUrl: string;
  issue: string;
};

const REMOTE_RETRY_DELAYS_MS = [0, 400, 1_200];
const REMOTE_CONCURRENCY = 12;
const REMOTE_TIMEOUT_MS = 15_000;

function cliValue(prefix: string): string | null {
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value?.slice(prefix.length).trim() || null;
}

function remoteBaseUrl(): string {
  const value = cliValue("--base-url=") ?? "https://app.viza.it.com";
  const parsed = new URL(value);
  if (!/^https?:$/u.test(parsed.protocol)) {
    throw new Error("--base-url must use http or https");
  }
  return parsed.toString().replace(/\/$/u, "");
}

async function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function verifyRemoteImage(
  imageUrl: string,
  baseUrl: string
): Promise<string | null> {
  const target = imageUrl.startsWith("/") ? `${baseUrl}${imageUrl}` : imageUrl;
  let lastFailure = "request failed";

  for (const [attempt, delayMs] of REMOTE_RETRY_DELAYS_MS.entries()) {
    await wait(delayMs);
    try {
      const response = await fetch(target, {
        redirect: "follow",
        signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "User-Agent": "VIZA-Travel-Image-Verification/2.0",
        },
      });
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
        if (
          attempt < REMOTE_RETRY_DELAYS_MS.length - 1 &&
          (response.status === 408 ||
            response.status === 429 ||
            response.status >= 500)
        ) {
          continue;
        }
        return `${target}: ${lastFailure}`;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLocaleLowerCase().startsWith("image/")) {
        return `${target}: expected image MIME type, received ${contentType || "none"}`;
      }

      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0) return `${target}: empty response body`;
      const metadata = await sharp(body, { failOn: "error" }).metadata();
      if (!metadata.width || !metadata.height) {
        return `${target}: decoded image has no pixel dimensions`;
      }
      return null;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "request failed";
      if (attempt === REMOTE_RETRY_DELAYS_MS.length - 1) {
        return `${target}: ${lastFailure}`;
      }
    }
  }

  return `${target}: ${lastFailure}`;
}

async function verifyRemoteImages(
  images: Map<string, string>,
  baseUrl: string
): Promise<ImageIssue[]> {
  const queue = [...images.entries()];
  const issues: ImageIssue[] = [];
  await Promise.all(
    Array.from({ length: REMOTE_CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const item = queue.pop();
        if (!item) return;
        const [imageUrl, entity] = item;
        const failure = await verifyRemoteImage(imageUrl, baseUrl);
        if (failure) {
          issues.push({
            severity: "error",
            entity,
            imageUrl,
            issue: failure,
          });
        }
      }
    })
  );
  return issues.sort((left, right) =>
    left.imageUrl.localeCompare(right.imageUrl)
  );
}

function localAssetExists(imageUrl: string): boolean {
  if (!imageUrl.startsWith("/")) return true;
  // Travel card binaries are hosted in Supabase Storage and exposed through
  // the Next.js /travel/* rewrite, so they are intentionally absent locally.
  if (imageUrl.startsWith("/travel/")) return true;
  return fs.existsSync(
    path.resolve(process.cwd(), "public", imageUrl.slice(1))
  );
}

function isPlaceholder(imageUrl: string): boolean {
  return /travel-fallback|placeholder/i.test(imageUrl);
}

function inspectAsset(options: {
  asset: TravelDestinationAssetContract | null | undefined;
  entity: string;
  entityNames: string[];
  cityNames: string[];
  seenImages: Map<string, string>;
}): ImageIssue[] {
  const issues: ImageIssue[] = [];
  const asset = options.asset;
  if (!asset) {
    issues.push({
      severity: "warn",
      entity: options.entity,
      imageUrl: "-",
      issue: "missing image asset",
    });
    return issues;
  }

  if (!asset.source || !asset.sourceUrl) {
    issues.push({
      severity: "error",
      entity: options.entity,
      imageUrl: asset.imageUrl,
      issue: "missing source/source_url",
    });
  }

  if (!asset.attribution) {
    issues.push({
      severity: "warn",
      entity: options.entity,
      imageUrl: asset.imageUrl,
      issue: "missing attribution",
    });
  }

  if (isPlaceholder(asset.imageUrl) && asset.verified) {
    issues.push({
      severity: "error",
      entity: options.entity,
      imageUrl: asset.imageUrl,
      issue: "placeholder marked verified",
    });
  }

  if (!localAssetExists(asset.imageUrl)) {
    issues.push({
      severity: "error",
      entity: options.entity,
      imageUrl: asset.imageUrl,
      issue: "local image file missing",
    });
  }

  const verification = verifyTravelImageRelevance({
    imageUrl: asset.imageUrl,
    sourceUrl: asset.sourceUrl,
    entityNames: options.entityNames,
    cityNames: options.cityNames,
  });
  if (verification.confidenceScore < 0.55 || !verification.verified) {
    issues.push({
      severity: "error",
      entity: options.entity,
      imageUrl: asset.imageUrl,
      issue: `low relevance confidence ${verification.confidenceScore}`,
    });
  }

  const existingEntity = options.seenImages.get(asset.imageUrl);
  if (existingEntity && existingEntity !== options.entity) {
    issues.push({
      severity: "warn",
      entity: options.entity,
      imageUrl: asset.imageUrl,
      issue: `duplicate image also used by ${existingEntity}`,
    });
  } else {
    options.seenImages.set(asset.imageUrl, options.entity);
  }

  return issues;
}

async function main() {
  const contracts = getDropdownDestinationContracts();
  const seenImages = new Map<string, string>();
  const issues: ImageIssue[] = [];

  for (const destination of contracts) {
    const cityNames = [
      destination.nameEn,
      destination.nameZh,
      destination.canonicalName,
      ...destination.aliases,
    ];
    issues.push(
      ...inspectAsset({
        asset: destination.coverImage,
        entity: `${destination.nameEn} cover`,
        entityNames: [destination.nameEn, destination.nameZh],
        cityNames,
        seenImages,
      })
    );

    for (const attraction of destination.attractions) {
      issues.push(
        ...inspectAsset({
          asset: attraction.image,
          entity: `${destination.nameEn} / ${attraction.nameZh}`,
          entityNames: [
            attraction.nameEn,
            attraction.nameZh,
            attraction.canonicalName,
          ],
          cityNames,
          seenImages,
        })
      );
    }
  }

  const checkRemote = process.argv.includes("--check-remote");
  if (checkRemote) {
    const baseUrl = remoteBaseUrl();
    console.log(
      `Fetching and decoding ${seenImages.size} unique images through ${baseUrl} ...`
    );
    issues.push(...(await verifyRemoteImages(seenImages, baseUrl)));
  }

  if (issues.length > 0) {
    console.table(issues);
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  console.log(
    `Checked ${contracts.length} destinations and ${seenImages.size} unique image URLs.`
  );
  if (checkRemote) {
    console.log(
      "Every remote response was checked for image MIME type and pixel decoding."
    );
  }
  console.log(
    `${errors.length} errors, ${issues.length - errors.length} warnings.`
  );

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
