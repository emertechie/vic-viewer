import { z } from "zod";

export const relativeRangeSchema = z.enum(["5m", "15m", "1h", "6h", "24h"]);

export type RelativeRange = z.infer<typeof relativeRangeSchema>;
