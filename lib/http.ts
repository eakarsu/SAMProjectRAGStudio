import { ZodError } from "zod";
import { DuplicateError, NotFoundError } from "@/lib/project-repository";
import { UnauthorizedError } from "@/lib/request-auth";
import { ConflictError, ForbiddenError } from "@/lib/errors";

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";
  if (error instanceof UnauthorizedError)
    return json({ error: message }, { status: 401 });
  if (error instanceof ForbiddenError)
    return json({ error: message }, { status: 403 });
  if (error instanceof NotFoundError)
    return json({ error: message }, { status: 404 });
  if (error instanceof ConflictError)
    return json({ error: message }, { status: 409 });
  if (error instanceof DuplicateError)
    return json({ error: message }, { status: 409 });
  if (error instanceof SyntaxError)
    return json(
      { error: "The request body is not valid JSON." },
      { status: 400 },
    );
  if (error instanceof ZodError)
    return json(
      { error: "The submitted fields are incomplete or invalid." },
      { status: 422 },
    );
  if (
    error instanceof Error &&
    /required|unsupported|invalid|must|could not|no extractable/i.test(message)
  ) {
    return json({ error: message }, { status: 422 });
  }
  console.error(
    "Request failed",
    error instanceof Error
      ? { name: error.name, message: error.message }
      : "Unknown error",
  );
  return json(
    { error: "The request could not be completed." },
    { status: 500 },
  );
}
