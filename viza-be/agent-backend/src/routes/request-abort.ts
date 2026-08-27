import type { Request, Response } from "express";

/**
 * Converts an aborted HTTP upload or a prematurely closed response into one
 * request-scoped signal. A normal completed response removes both listeners.
 */
export function createRequestAbortSignal(req: Request, res: Response): AbortSignal {
  const controller = new AbortController();
  const cleanup = () => {
    req.removeListener("aborted", abort);
    res.removeListener("finish", finish);
    res.removeListener("close", close);
  };
  const abort = () => {
    if (!controller.signal.aborted) controller.abort(new Error("HTTP request aborted"));
    cleanup();
  };
  const finish = () => cleanup();
  const close = () => {
    if (!res.writableFinished) abort();
    else cleanup();
  };

  req.once("aborted", abort);
  res.once("finish", finish);
  res.once("close", close);
  return controller.signal;
}
