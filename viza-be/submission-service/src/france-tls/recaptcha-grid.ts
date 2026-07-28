import type { Page } from "@playwright/test";
import { solveGridCaptcha, type GridCaptchaSolveResult } from "../captcha";

export interface GridImageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridTileCentersInput {
  imageBox: GridImageBox;
  rows: number;
  columns: number;
  tiles: number[];
}

export interface GridClickPoint {
  x: number;
  y: number;
}

export interface RecaptchaGridSolveOptions {
  frameSelector?: string;
  maxRounds?: number;
  timeoutMs?: number;
}

export type RecaptchaGridSolveOutcome =
  | { status: "solved"; solves: GridCaptchaSolveResult[] }
  | { status: "no_challenge"; reason: string }
  | { status: "failed"; reason: string; solves: GridCaptchaSolveResult[] };

const DEFAULT_RECAPTCHA_CHALLENGE_FRAME = 'iframe[src*="recaptcha"][src*="bframe"]';
const IMAGE_SELECTOR = ".rc-imageselect-table, .rc-image-tile-wrapper, img.rc-image-tile-33, img.rc-image-tile-44";
const VERIFY_SELECTOR = "#recaptcha-verify-button";
const INSTRUCTION_SELECTOR = ".rc-imageselect-desc-no-canonical, .rc-imageselect-desc, .rc-imageselect-instructions";

export function gridTileCenters(input: GridTileCentersInput): GridClickPoint[] {
  const rows = Math.trunc(input.rows);
  const columns = Math.trunc(input.columns);
  if (rows <= 0 || columns <= 0) {
    throw new Error(`invalid grid dimensions ${input.rows}x${input.columns}`);
  }

  const cellWidth = input.imageBox.width / columns;
  const cellHeight = input.imageBox.height / rows;
  const maxTile = rows * columns;

  return input.tiles.map((tile) => {
    const normalizedTile = Math.trunc(tile);
    if (normalizedTile < 1 || normalizedTile > maxTile) {
      throw new Error(`tile ${tile} is outside ${rows}x${columns} grid`);
    }

    const zeroBased = normalizedTile - 1;
    const row = Math.floor(zeroBased / columns);
    const column = zeroBased % columns;
    return {
      x: Math.round(input.imageBox.x + column * cellWidth + cellWidth / 2),
      y: Math.round(input.imageBox.y + row * cellHeight + cellHeight / 2),
    };
  });
}

export function inferGridDimensionsFromTileCount(tileCount: number): { rows: number; columns: number } {
  if (tileCount >= 16) return { rows: 4, columns: 4 };
  return { rows: 3, columns: 3 };
}

export async function solveVisibleRecaptchaGridChallenge(
  page: Page,
  options: RecaptchaGridSolveOptions = {},
): Promise<RecaptchaGridSolveOutcome> {
  const frame = page.frameLocator(options.frameSelector ?? DEFAULT_RECAPTCHA_CHALLENGE_FRAME);
  const image = frame.locator(IMAGE_SELECTOR).first();
  const solves: GridCaptchaSolveResult[] = [];

  const imageCount = await image.count().catch(() => 0);
  if (imageCount === 0) {
    return { status: "no_challenge", reason: "recaptcha grid image not found" };
  }

  for (let round = 1; round <= (options.maxRounds ?? 3); round += 1) {
    await image.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    const box = await image.boundingBox({ timeout: 5_000 }).catch(() => null);
    if (!box || box.width <= 0 || box.height <= 0) {
      return { status: "failed", reason: "recaptcha grid image has no visible bounding box", solves };
    }

    const instruction = (await frame.locator(INSTRUCTION_SELECTOR).first().innerText({ timeout: 5_000 }).catch(() => "")).trim();
    if (!instruction) {
      return { status: "failed", reason: "recaptcha grid instruction not found", solves };
    }

    const tileCount = await frame.locator(".rc-imageselect-tile").count().catch(() => 9);
    const dimensions = inferGridDimensionsFromTileCount(tileCount);
    const imageBuffer = await image.screenshot({ timeout: 15_000 });
    const solve = await solveGridCaptcha(imageBuffer, {
      rows: dimensions.rows,
      columns: dimensions.columns,
      comment: instruction,
      previousId: solves.at(-1)?.solveId,
      timeoutMs: options.timeoutMs,
    });
    solves.push(solve);

    const points = gridTileCenters({
      imageBox: box,
      rows: dimensions.rows,
      columns: dimensions.columns,
      tiles: solve.clicks,
    });
    for (const point of points) {
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(150);
    }

    const verify = frame.locator(VERIFY_SELECTOR).first();
    if ((await verify.count().catch(() => 0)) > 0) {
      await verify.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(2_000);
    }

    const stillVisible = await image.isVisible({ timeout: 1_000 }).catch(() => false);
    if (!stillVisible) {
      return { status: "solved", solves };
    }
  }

  return { status: "failed", reason: "recaptcha grid remained visible after max rounds", solves };
}
