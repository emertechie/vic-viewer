import type { UpstreamRequestOptions } from "./types";
import { UpstreamRequestError } from "./upstreamError";

export async function performUpstreamRequest<T>(options: {
  source: "victoria-logs" | "victoria-traces" | "victoria-metrics";
  url: string;
  timeoutMs: number;
  parse: (responseText: string) => T;
  request?: UpstreamRequestOptions;
}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  const signal = options.request?.signal
    ? AbortSignal.any([controller.signal, options.request.signal])
    : controller.signal;

  try {
    const response = await fetch(options.url, {
      method: options.request?.method ?? "GET",
      body: options.request?.body,
      headers: options.request?.headers,
      signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new UpstreamRequestError({
        source: options.source,
        statusCode: response.status,
        message: `Upstream request failed with status ${response.status}`,
        body: responseText,
      });
    }

    return options.parse(responseText);
  } catch (error) {
    if (error instanceof UpstreamRequestError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamRequestError({
        source: options.source,
        statusCode: 504,
        message: `Upstream request timeout after ${options.timeoutMs}ms`,
        body: "",
      });
    }

    throw new UpstreamRequestError({
      source: options.source,
      statusCode: 502,
      message: "Upstream request failed",
      body: error instanceof Error ? error.message : "Unknown upstream failure",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
