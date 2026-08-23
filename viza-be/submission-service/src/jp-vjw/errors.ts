export class JpVjwPortalError extends Error {
  readonly code: string;
  readonly screenshotPaths: string[];
  readonly logs: string[];

  constructor(message: string, options: { code: string; screenshotPaths?: string[]; logs?: string[] }) {
    super(message);
    this.name = "JpVjwPortalError";
    this.code = options.code;
    this.screenshotPaths = options.screenshotPaths ?? [];
    this.logs = options.logs ?? [];
  }
}
