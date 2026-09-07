import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, "page must be greater than or equal to 1")),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(
      z
        .number()
        .int()
        .min(1, "limit must be greater than or equal to 1")
        .max(100, "limit cannot exceed 100")
    ),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
