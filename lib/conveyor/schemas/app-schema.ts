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
        required: z.boolean().optional(),
        sort_order: z.number().nullable().optional(),
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
          fatherOrHusband: z.string().optional().nullable(),
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
  'open-report-preview': {
    args: z.tuple([
      z.object({
        report: z.any(),
      }),
    ]),
    return: z.object({ opened: z.boolean() }),
  },
  'print-report': {
    args: z.tuple([
      z.object({
        report: z.any(),
      }),
    ]),
    return: z.object({ printed: z.boolean(), error: z.string().optional() }),
  },
  // New: list recent test record summaries
  'recent-test-records': {
    args: z.tuple([z.object({ limit: z.number().min(1).max(500).default(50) }).default({ limit: 50 })]),
    return: z.array(
      z.object({
        id: z.number(),
        patient_name: z.string().nullable(),
        patient_age: z.number().nullable().optional(),
        patient_sex: z.string().nullable().optional(),
        patient_father_or_husband: z.string().nullable().optional(),
        created_at: z.string().nullable().optional(),
      })
    ),
  },
  // New: get all tests grouped by category
  'all-tests-grouped': {
    args: z.tuple([]),
    return: z.array(
      z.object({
        category: z.string(),
        tests: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            result: z.string().nullable().optional(),
            normal_value: z.string().nullable().optional(),
            required: z.boolean().optional(),
            sort_order: z.number().nullable().optional(),
            timestamp: z.string().nullable().optional(),
          })
        ),
      })
    ),
  },
  // New: add a test category
  'add-test-category': {
    args: z.tuple([z.object({ category: z.string().min(1) })]),
    return: z.object({ created: z.boolean(), category: z.string() }),
  },
  // New: add a single test to a category
  'add-test': {
    args: z.tuple([
      z.object({
        category: z.string().min(1),
        name: z.string().min(1),
        normal_value: z.string().optional().nullable(),
      }),
    ]),
    return: z.object({ id: z.number(), inserted: z.boolean(), required: z.boolean().optional() }),
  },
  // New: update a test's normal value
  'update-test-normal': {
    args: z.tuple([z.object({ id: z.number(), normal_value: z.string().optional().nullable() })]),
    return: z.object({ updated: z.boolean() }),
  },
  // New: update a test's required flag
  'update-test-required': {
    args: z.tuple([z.object({ id: z.number(), required: z.boolean() })]),
    return: z.object({ updated: z.boolean(), required: z.boolean().optional() }),
  },
  // New: maintenance reseed tests
  'maintenance-reseed-tests': {
    args: z.tuple([]),
    return: z.object({ inserted: z.number(), skipped: z.number(), reset: z.boolean().optional() }),
  },
  // New: export all tests as flat array
  'export-tests': {
    args: z.tuple([]),
    return: z.array(
      z.object({
        id: z.number().optional(),
        category: z.string(),
        name: z.string(),
        normal_value: z.string().nullable().optional(),
        result: z.string().nullable().optional(),
        required: z.boolean().optional(),
        sort_order: z.number().nullable().optional(),
      })
    ),
  },
  // New: import tests from provided JSON array; ignores duplicates
  'import-tests': {
    args: z.tuple([
      z.array(
        z.object({
          id: z.number().optional(),
          category: z.string().min(1),
          name: z.string().min(1),
          normal_value: z.string().optional().nullable(),
          result: z.string().optional().nullable(),
          required: z.boolean().optional(),
          sort_order: z.number().nullable().optional(),
        })
      ),
    ]),
    return: z.object({ inserted: z.number(), skipped: z.number() }),
  },
}
