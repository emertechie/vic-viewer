import { logProfileSchema, type LogProfile } from "../schemas/logProfiles";

export const fallbackLogProfile: LogProfile = logProfileSchema.parse({
  id: "fallback",
  name: "Fallback",
  version: 1,
  coreFields: {
    time: { field: "_time" },
    message: { field: "_msg" },
    streamId: { field: "_stream_id" },
    stream: { field: "_stream" },
    severity: { fields: ["severity", "SeverityText"] },
    serviceName: { field: "service.name" },
    traceId: { fields: ["trace_id", "TraceId"] },
    spanId: { fields: ["span_id", "SpanId"] },
  },
  tieBreaker: {
    fields: ["_stream_id", "span_id", "SpanId", "trace_id", "TraceId", "_msg"],
  },
  logTable: {
    columns: [
      { id: "time", title: "Time", field: "_time" },
      { id: "level", title: "Level", fields: ["severity", "SeverityText"] },
      { id: "service", title: "Service", field: "service.name" },
      { id: "message", title: "Message", field: "_msg" },
      { id: "trace-id", title: "TraceId", fields: ["trace_id", "TraceId"] },
      { id: "span-id", title: "SpanId", fields: ["span_id", "SpanId"] },
    ],
  },
  logDetails: {
    fieldSets: [
      {
        id: "core",
        name: "Core",
        fields: [
          { title: "Time", field: "_time" },
          { title: "Level", fields: ["severity", "SeverityText"] },
          { title: "Service", field: "service.name" },
          { title: "Message", field: "_msg" },
        ],
      },
    ],
  },
});
