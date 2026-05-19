import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";

type TokenScope = "internal" | "external";

const AUTH_PREFIX = "Bearer ";

function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith(AUTH_PREFIX)) return null;

  const token = authHeader.slice(AUTH_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

function getConfiguredTokens(scope: TokenScope): string[] {
  const internalTokens = [
    process.env.INTERNAL_AUTOMATION_TOKEN,
    process.env.AGENT_BACKEND_INTERNAL_TOKEN,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ];

  if (scope === "internal") {
    return internalTokens.filter((token): token is string => Boolean(token));
  }

  return [
    process.env.EXTERNAL_SUBMISSION_TOKEN,
    ...internalTokens,
  ].filter((token): token is string => Boolean(token));
}

function tokensMatch(providedToken: string, configuredToken: string): boolean {
  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);

  if (provided.length !== configured.length) return false;
  return timingSafeEqual(provided, configured);
}

function requireToken(scope: TokenScope) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const providedToken = readBearerToken(req);

    if (!providedToken) {
      res.status(401).json({
        error: true,
        code: "unauthorized",
        message: "Bearer token required",
      });
      return;
    }

    const configuredTokens = getConfiguredTokens(scope);
    if (configuredTokens.length === 0) {
      res.status(500).json({
        error: true,
        code: "token_not_configured",
        message: "Service token is not configured",
      });
      return;
    }

    if (!configuredTokens.some((token) => tokensMatch(providedToken, token))) {
      res.status(401).json({
        error: true,
        code: "unauthorized",
        message: "Invalid service token",
      });
      return;
    }

    next();
  };
}

export const requireInternalAutomationToken = requireToken("internal");
export const requireExternalSubmissionToken = requireToken("external");
