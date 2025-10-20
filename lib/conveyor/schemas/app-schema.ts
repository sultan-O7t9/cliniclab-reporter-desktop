import { z } from 'zod'

export const appIpcSchema = {
  version: {
    args: z.tuple([]),
    return: z.string(),
  },
  // One-time 2025 tests update: check/prompt/apply
  'needs-tests-update-2025': {
    args: z.tuple([]),
    return: z.object({ needs: z.boolean() }),
  },
  'mark-tests-update-prompted-2025': {
    args: z.tuple([]),
    return: z.object({ ok: z.boolean() }),
  },
  'apply-tests-update-2025': {
    args: z.tuple([]),
    return: z.object({ inserted: z.number(), updated: z.number() }),
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
        normal_spec: z.string().nullable().optional(),
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
                result: z.string().optional().nullable(),
                normal: z.string().optional().nullable(),
                category: z.string(),
                // Optional nested children for hierarchical tests
                children: z
                  .array(
                    z.object({
                      name: z.string(),
                      result: z.string(),
                      normal: z.string().optional().nullable(),
                    })
                  )
                  .optional()
                  .nullable(),
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
  // Generate PDF for preview / high quality printing (scale ~0.5 - 2.0)
  'print-to-pdf': {
    args: z.tuple([
      z.object({
        report: z.any(),
        scale: z.number().optional().default(1),
      }),
    ]),
    return: z.object({ filePath: z.string(), dataUrl: z.string().optional() }),
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
        test_categories: z.string().nullable().optional(),
      })
    ),
  },
  'get-test-record': {
    args: z.tuple([z.number()]),
    return: z
      .object({
        id: z.number(),
        patient_name: z.string().nullable().optional(),
        patient_age: z.number().nullable().optional(),
        patient_sex: z.string().nullable().optional(),
        patient_father_or_husband: z.string().nullable().optional(),
        created_at: z.string().nullable().optional(),
        report: z.any().nullable().optional(),
      })
      .nullable(),
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
            normal_spec: z.string().nullable().optional(),
            required: z.boolean().optional(),
            sort_order: z.number().nullable().optional(),
            timestamp: z.string().nullable().optional(),
            // Optional parent-child nesting
            parent_id: z.number().nullable().optional(),
            children: z
              .array(
                z.object({
                  id: z.number(),
                  name: z.string(),
                  result: z.string().nullable().optional(),
                  normal_value: z.string().nullable().optional(),
                  normal_spec: z.string().nullable().optional(),
                  required: z.boolean().optional(),
                  sort_order: z.number().nullable().optional(),
                  timestamp: z.string().nullable().optional(),
                  parent_id: z.number().nullable().optional(),
                })
              )
              .optional(),
          })
        ),
      })
    ),
  },
  // New: tests by category with explicit nesting
  'tests-by-category-nested': {
    args: z.tuple([z.string()]),
    return: z.object({
      category: z.string(),
      tests: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          result: z.string().nullable().optional(),
          normal_value: z.string().nullable().optional(),
          normal_spec: z.string().nullable().optional(),
          required: z.boolean().optional(),
          sort_order: z.number().nullable().optional(),
          timestamp: z.string().nullable().optional(),
          parent_id: z.number().nullable().optional(),
          children: z
            .array(
              z.object({
                id: z.number(),
                name: z.string(),
                result: z.string().nullable().optional(),
                normal_value: z.string().nullable().optional(),
                normal_spec: z.string().nullable().optional(),
                required: z.boolean().optional(),
                sort_order: z.number().nullable().optional(),
                timestamp: z.string().nullable().optional(),
                parent_id: z.number().nullable().optional(),
              })
            )
            .optional(),
        })
      ),
    }),
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
        normal_spec: z.string().optional().nullable(),
      }),
    ]),
    return: z.object({ id: z.number(), inserted: z.boolean(), required: z.boolean().optional() }),
  },
  // New: update a test's normal value
  'update-test-normal': {
    args: z.tuple([z.object({ id: z.number(), normal_value: z.string().optional().nullable() })]),
    return: z.object({ updated: z.boolean() }),
  },
  // New: update a test's normal value and spec
  'update-test-normal-spec': {
    args: z.tuple([
      z.object({
        id: z.number(),
        normal_value: z.string().optional().nullable(),
        normal_spec: z.string().optional().nullable(),
      }),
    ]),
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
        normal_spec: z.string().nullable().optional(),
        result: z.string().nullable().optional(),
        required: z.boolean().optional(),
        sort_order: z.number().nullable().optional(),
        parent_id: z.number().nullable().optional(),
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
          normal_spec: z.string().optional().nullable(),
          result: z.string().optional().nullable(),
          required: z.boolean().optional(),
          sort_order: z.number().nullable().optional(),
          parent_id: z.number().nullable().optional(),
        })
      ),
    ]),
    return: z.object({ inserted: z.number(), updated: z.number().default(0), skipped: z.number() }),
  },
  // New: add a child test under a parent
  'add-child-test': {
    args: z.tuple([
      z.object({
        category: z.string().min(1),
        parent_id: z.number().min(1),
        name: z.string().min(1),
        normal_value: z.string().optional().nullable(),
        normal_spec: z.string().optional().nullable(),
      }),
    ]),
    return: z.object({ id: z.number(), inserted: z.boolean() }),
  },
  // New: search test records by patient name (case-insensitive)
  'search-test-records': {
    args: z.tuple([
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(500).default(50),
      }),
    ]),
    return: z.array(
      z.object({
        id: z.number(),
        patient_name: z.string().nullable(),
        patient_age: z.number().nullable().optional(),
        patient_sex: z.string().nullable().optional(),
        patient_father_or_husband: z.string().nullable().optional(),
        created_at: z.string().nullable().optional(),
        test_categories: z.string().nullable().optional(),
      })
    ),
  },
  // New: export logs
  'export-logs': {
    args: z.tuple([z.object({ format: z.enum(['json', 'txt']).default('json') })]),
    return: z.object({ filePath: z.string(), count: z.number() }),
  },
  // New: list logs with pagination + optional filters
  'list-logs': {
    args: z.tuple([
      z
        .object({
          offset: z.number().min(0).default(0),
          limit: z.number().min(1).max(500).default(50),
          level: z.string().optional().nullable(),
          action: z.string().optional().nullable(),
          search: z.string().optional().nullable(),
        })
        .default({ offset: 0, limit: 50 }),
    ]),
    return: z.object({
      total: z.number(),
      rows: z.array(
        z.object({
          id: z.number(),
          ts: z.string(),
          action: z.string(),
          level: z.string(),
          message: z.string().nullable().optional(),
          payload: z.any().nullable().optional(),
        })
      ),
    }),
  },
  // Reset database: archives existing file, recreates schema, re-seeds defaults
  'reset-database': {
    args: z.tuple([]),
    return: z.object({ reset: z.boolean() }),
  },
}
