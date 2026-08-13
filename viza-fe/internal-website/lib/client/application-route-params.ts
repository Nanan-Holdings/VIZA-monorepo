type SearchParamsReader = Pick<URLSearchParams, "get">;

function routeParamNameCandidates(name: string): string[] {
  const candidates = [name];
  let escaped = name;

  for (let depth = 0; depth < 3; depth += 1) {
    escaped = `amp;${escaped}`;
    candidates.push(escaped);
  }

  return candidates;
}

export function readApplicationRouteParam(
  searchParams: SearchParamsReader,
  ...names: string[]
): string | null {
  for (const name of names) {
    for (const candidate of routeParamNameCandidates(name)) {
      const value = searchParams.get(candidate)?.trim();
      if (value) return value;
    }
  }

  return null;
}
