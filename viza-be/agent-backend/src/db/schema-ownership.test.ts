import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableName, is, Table } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as drizzleSchema from "./schema.js";

type OwnershipClass = "drizzle-managed" | "rest-service-only" | "compatibility-only";

type OwnershipManifest = {
	version: number;
	reconciliation: {
		status: "reconciled";
		productionProjectRef: string;
		requiredArtifact: "architecture-audit";
		artifactPath: string;
		artifactSha256: string;
		auditRunId: number;
		auditJobId: number;
	};
	ownership: Record<OwnershipClass, string[]>;
	declaredButNotPresent: {
		"drizzle-managed": string[];
	};
};

type CatalogRelation = {
	schema: string;
	name: string;
	kind: "table" | "view";
	owner: string;
	rlsEnabled: boolean;
	rlsForced: boolean;
};

type CatalogArtifact = {
	version: number;
	metadataOnly: true;
	source: {
		projectRef: string;
		runId: number;
		jobId: number;
		runUrl: string;
		sourceRef: string;
		capturedAt: string;
	};
	querySchema: {
		auditSchemaVersion: number;
		catalogSchemaVersion: number;
		sanitizationSchema: string;
		source: string;
	};
	relationCount: number;
	relationsSha256: string;
	relations: CatalogRelation[];
};

const dbDirectory = new URL("./", import.meta.url);
const manifestPath = fileURLToPath(new URL("./schema-ownership.manifest.json", dbDirectory));
const schemaPath = fileURLToPath(new URL("./schema.ts", dbDirectory));
const manifestSource = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource) as OwnershipManifest;
const artifactPath = fileURLToPath(new URL(manifest.reconciliation.artifactPath, dbDirectory));
const artifactSource = readFileSync(artifactPath, "utf8");
const artifact = JSON.parse(artifactSource) as CatalogArtifact;
const schemaSource = readFileSync(schemaPath, "utf8");

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const relationId = (relation: Pick<CatalogRelation, "schema" | "name">) =>
	relation.schema === "public" ? relation.name : `${relation.schema}.${relation.name}`;

const exportedDrizzleTableNames = new Set(
	Object.values(drizzleSchema)
		.filter((value) => is(value, Table))
		.map((table) => getTableName(table)),
);

describe("database schema ownership reconciliation", () => {
	it("binds the reconciled manifest to the exact metadata-only production artifact", () => {
		expect(Object.keys(artifact).toSorted()).toEqual(
			[
				"metadataOnly",
				"querySchema",
				"relationCount",
				"relations",
				"relationsSha256",
				"source",
				"version",
			].toSorted(),
		);
		expect(Object.keys(artifact.source).toSorted()).toEqual(
			["capturedAt", "jobId", "projectRef", "runId", "runUrl", "sourceRef"].toSorted(),
		);
		expect(Object.keys(artifact.querySchema).toSorted()).toEqual(
			["auditSchemaVersion", "catalogSchemaVersion", "sanitizationSchema", "source"].toSorted(),
		);
		expect(manifest.version).toBe(3);
		expect(manifest.reconciliation).toMatchObject({
			status: "reconciled",
			productionProjectRef: "oyjxdzsoejraedqghndi",
			requiredArtifact: "architecture-audit",
			auditRunId: 32507190455,
			auditJobId: 96849890973,
		});
		expect(manifest.reconciliation.artifactPath).toMatch(/^\.\/production-catalog\.[a-z0-9.-]+\.json$/);
		expect(sha256(artifactSource)).toBe(manifest.reconciliation.artifactSha256);
		expect(artifact).toMatchObject({
			version: 1,
			metadataOnly: true,
				source: {
					projectRef: manifest.reconciliation.productionProjectRef,
					runId: manifest.reconciliation.auditRunId,
					jobId: manifest.reconciliation.auditJobId,
					sourceRef: "ad72610156ca324fe61298c942288b98ba50521d",
					capturedAt: "2026-08-21T17:15:45.525Z",
				},
			querySchema: {
				auditSchemaVersion: 1,
				catalogSchemaVersion: 1,
				sanitizationSchema: "viza-architecture-audit-metadata-only-v1",
				source: "supabase-management-api-read-only",
			},
		});
		expect(Number.isNaN(Date.parse(artifact.source.capturedAt))).toBe(false);
		expect(artifact.source.runUrl).toBe(
			`https://github.com/Nanan-Holdings/VIZA-monorepo/actions/runs/${artifact.source.runId}`,
		);
	});

	it("contains only the sorted table/view ownership and RLS metadata audited in production", () => {
		expect(artifact.relationCount).toBe(artifact.relations.length);
		expect(artifact.relations.length).toBeGreaterThan(0);
		expect(artifact.relations.map(relationId)).toEqual(
			artifact.relations.map(relationId).toSorted((left, right) => left.localeCompare(right)),
		);
		expect(new Set(artifact.relations.map(relationId)).size).toBe(artifact.relations.length);
		expect(sha256(JSON.stringify(artifact.relations))).toBe(artifact.relationsSha256);

		for (const relation of artifact.relations) {
			expect(Object.keys(relation).toSorted()).toEqual(
				["kind", "name", "owner", "rlsEnabled", "rlsForced", "schema"].toSorted(),
			);
			expect(["table", "view"]).toContain(relation.kind);
			expect(relation.owner).not.toBe("");
			expect(typeof relation.rlsEnabled).toBe("boolean");
			expect(typeof relation.rlsForced).toBe("boolean");
		}
	});

	it("explains every live production relation exactly once without a test-side catalog copy", () => {
		const liveRelations = artifact.relations.map(relationId);
		const assignments = Object.values(manifest.ownership).flat();
		expect(new Set(assignments).size).toBe(assignments.length);
		expect(assignments.toSorted()).toEqual(liveRelations.toSorted());
	});

	it("reconciles the live catalog with actual Drizzle exports and explicit exceptions", () => {
		const liveRelations = new Set(artifact.relations.map(relationId));
		const liveDrizzleTables = manifest.ownership["drizzle-managed"];
		const absentDrizzleTables = manifest.declaredButNotPresent["drizzle-managed"];

		for (const table of liveDrizzleTables) {
			expect(table).not.toContain(".");
			expect(exportedDrizzleTableNames.has(table)).toBe(true);
		}
		for (const table of absentDrizzleTables) {
			expect(exportedDrizzleTableNames.has(table)).toBe(true);
			expect(liveRelations.has(table)).toBe(false);
		}

		expect([...exportedDrizzleTableNames].toSorted()).toEqual(
			[...liveDrizzleTables, ...absentDrizzleTables].toSorted(),
		);

		for (const table of [
			...manifest.ownership["rest-service-only"],
			...manifest.ownership["compatibility-only"],
		]) {
			expect(exportedDrizzleTableNames.has(table)).toBe(false);
		}

		const liveViews = artifact.relations.filter((relation) => relation.kind === "view").map(relationId);
		for (const view of liveViews) {
			expect(manifest.ownership["rest-service-only"]).toContain(view);
		}
	});

	it("keeps migration-owned compatibility details out of generated Drizzle metadata", () => {
		expect(schemaSource).toMatch(/TYPE-ONLY SCHEMA COMPATIBILITY/i);
		expect(schemaSource).toMatch(
			/runner_concurrency_metric[\s\S]*GENERATED BY DEFAULT AS IDENTITY[\s\S]*recorded_at DESC/i,
		);
		expect(schemaSource).toMatch(/application_inbox_aliases[\s\S]*created_at DESC/i);
		expect(schemaSource).toMatch(/id:\s*bigint\("id",\s*\{\s*mode:\s*"number"\s*\}\)\.primaryKey\(\)/i);
		expect(schemaSource).not.toContain('index("runner_concurrency_metric_recorded_idx")');
		expect(schemaSource).not.toContain('index("runner_concurrency_metric_event_recorded_idx")');
		expect(schemaSource).not.toContain('index("application_inbox_aliases_applicant_idx")');
	});
});
