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
}
