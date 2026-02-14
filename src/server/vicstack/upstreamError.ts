export class UpstreamRequestError extends Error {
  public readonly statusCode: number;
  public readonly source: "victoria-logs" | "victoria-traces" | "victoria-metrics";
  public readonly body: string;

  constructor(options: {
    message: string;
    statusCode: number;
    source: "victoria-logs" | "victoria-traces" | "victoria-metrics";
    body: string;
  }) {
    super(options.message);
    this.name = "UpstreamRequestError";
    this.statusCode = options.statusCode;
    this.source = options.source;
    this.body = options.body;
  }
}
