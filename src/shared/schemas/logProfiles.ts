import { z } from "zod";

const fieldNameSchema = z.string().min(1);

const singleFieldSelectorSchema = z.object({
  field: fieldNameSchema,
});

const fallbackFieldSelectorSchema = z.object({
  fields: z.array(fieldNameSchema).min(1),
});

export const profileFieldSelectorSchema = z.union([
  singleFieldSelectorSchema,
  fallbackFieldSelectorSchema,
]);

export const logProfileCoreFieldsSchema = z.object({
  time: profileFieldSelectorSchema,
  message: profileFieldSelectorSchema,
  streamId: profileFieldSelectorSchema.optional(),
  stream: profileFieldSelectorSchema.optional(),
  severity: profileFieldSelectorSchema.optional(),
  serviceName: profileFieldSelectorSchema.optional(),
  traceId: profileFieldSelectorSchema.optional(),
  spanId: profileFieldSelectorSchema.optional(),
});

const logProfileFieldSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    field: fieldNameSchema.optional(),
    fields: z.array(fieldNameSchema).min(1).optional(),
    type: z.enum(["sql", "StructuredLoggingFields", "RemainingFields"]).optional(),
    hidden: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    const isSpecialField =
      value.type === "StructuredLoggingFields" || value.type === "RemainingFields";
    const hasSingleField = typeof value.field === "string";
    const hasFallbackFields = Array.isArray(value.fields) && value.fields.length > 0;

    if (hasSingleField && hasFallbackFields) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Field entries must provide either 'field' or 'fields', not both",
      });
    }

    if (isSpecialField) {
      if (hasSingleField || hasFallbackFields) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Special field entries cannot define 'field' or 'fields'",
        });
      }
      return;
    }

    if (!hasSingleField && !hasFallbackFields) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Field entries must define either 'field' or 'fields'",
      });
    }
  });

export const logProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive(),
  coreFields: logProfileCoreFieldsSchema,
  tieBreaker: z.object({
    fields: z.array(fieldNameSchema).min(1),
  }),
  logTable: z.object({
    columns: z.array(logProfileFieldSchema).min(1),
  }),
  logDetails: z.object({
    fieldSets: z
      .array(
        z.object({
          id: z.string().min(1).optional(),
          name: z.string().min(1),
          fields: z.array(logProfileFieldSchema).min(1),
        }),
      )
      .min(1),
  }),
});

export type ProfileFieldSelector = z.infer<typeof profileFieldSelectorSchema>;
export type LogProfile = z.infer<typeof logProfileSchema>;
