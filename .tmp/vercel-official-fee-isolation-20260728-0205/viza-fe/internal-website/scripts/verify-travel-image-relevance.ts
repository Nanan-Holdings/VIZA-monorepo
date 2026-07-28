import * as fs from "node:fs";
import * as path from "node:path";
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

function localAssetExists(imageUrl: string): boolean {
  if (!imageUrl.startsWith("/")) return true;
  return fs.existsSync(path.resolve(process.cwd(), "public", imageUrl.slice(1)));
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

function main() {
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

  if (issues.length > 0) {
    console.table(issues);
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  console.log(
    `Checked ${contracts.length} destinations and ${seenImages.size} unique image URLs.`
  );
  console.log(`${errors.length} errors, ${issues.length - errors.length} warnings.`);

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
