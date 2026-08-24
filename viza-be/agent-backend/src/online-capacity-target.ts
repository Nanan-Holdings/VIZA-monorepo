export interface OnlineCapacityTargetMarker {
	enabled: true;
	mode: "local-test" | "staging-only";
	projectRef: string;
}

function parseProjectRef(urlValue: string, mode: OnlineCapacityTargetMarker["mode"]): string {
	let url: URL;
	try {
		url = new URL(urlValue);
	} catch {
		throw new Error("Online capacity target Supabase URL is invalid");
	}

	const hostname = url.hostname.toLowerCase();
	if (mode === "local-test") {
		if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
			throw new Error("Local online capacity target must use loopback Supabase");
		}
		return "local-test";
	}

	const match = /^([a-z0-9]{20})\.supabase\.co$/u.exec(hostname);
	if (!match?.[1]) {
		throw new Error("Staging online capacity target must use an exact Supabase project URL");
	}
	return match[1];
}

/** Returns no marker unless the deployment explicitly opts into safe load testing. */
export function readOnlineCapacityTargetMarker(
	env: Readonly<Record<string, string | undefined>> = process.env,
): OnlineCapacityTargetMarker | null {
	if (env.ONLINE_CAPACITY_TARGET_ENABLED?.trim() !== "true") return null;

	const mode = env.ONLINE_CAPACITY_TARGET_MODE?.trim();
	if (mode !== "local-test" && mode !== "staging-only") {
		throw new Error("ONLINE_CAPACITY_TARGET_MODE must be local-test or staging-only");
	}
	const supabaseUrl =
		env.SUPABASE_URL?.trim() ?? env.NEXT_PUBLIC_SUPABASE_URL?.trim();
	if (!supabaseUrl) throw new Error("Supabase URL is required for online capacity target binding");

	return {
		enabled: true,
		mode,
		projectRef: parseProjectRef(supabaseUrl, mode),
	};
}
