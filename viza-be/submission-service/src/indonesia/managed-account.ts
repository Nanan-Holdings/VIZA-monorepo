export function hasPreparedIndonesiaPortalAccount(input: {
  email: string | null | undefined;
  password: string | null | undefined;
}): boolean {
  return Boolean(input.email?.trim()) && Boolean(input.password);
}
