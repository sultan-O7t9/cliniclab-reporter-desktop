import { z } from 'zod'

export const appIpcSchema = {
  version: {
    args: z.tuple([]),
    return: z.string(),
  },
  'test-categories': {
    args: z.tuple([]),
    return: z.array(z.string()),
  },
  'tests-by-category': {
    args: z.tuple([z.string()]),
    return: z.array(
      z.object({
        id: z.number(),
        category: z.string(),
        name: z.string(),
        result: z.string().nullable().optional(),
        normal_value: z.string().nullable().optional(),
        timestamp: z.string().nullable().optional(),
      })
    ),
  },
  'save-test-record': {
    args: z.tuple([
      z.object({
        patient: z.object({
          name: z.string().optional().default(''),
          age: z.string().or(z.number()).optional().nullable(),
          sex: z.string().optional().default(''),
        }),
        tests: z.array(
          z.object({
            category: z.string(),
            tests: z.array(
              z.object({
                name: z.string(),
                result: z.string(),
                normal: z.string().optional().nullable(),
                category: z.string(),
              })
            ),
          })
        ),
        generatedAt: z.string(),
      }),
    ]),
    return: z.object({ id: z.number() }),
  },
  'generate-report-pdf': {
    args: z.tuple([
      z.object({
        report: z.any(), // raw report object we already built
      }),
    ]),
    return: z.object({ filePath: z.string() }),
  },
}
