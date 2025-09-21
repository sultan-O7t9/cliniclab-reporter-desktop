import { ConveyorApi } from '@/lib/preload/shared'

export class AppApi extends ConveyorApi {
  version = () => this.invoke('version')
  testCategories = () => this.invoke('test-categories')
  testsByCategory = (category: string) => this.invoke('tests-by-category', category)
  testsByCategoryNested = (category: string) => this.invoke('tests-by-category-nested', category)
  allTestsGrouped = () => this.invoke('all-tests-grouped')
  addTest = (category: string, name: string, normal_value?: string | null) =>
    this.invoke('add-test', { category, name, normal_value: normal_value ?? null })
  saveTestRecord = (report: any) => this.invoke('save-test-record', report)
  printReport = (report: any) => this.invoke('print-report', { report })
  recentTestRecords = (limit: number) => this.invoke('recent-test-records', { limit })
  searchTestRecords = (query: string, limit: number) => this.invoke('search-test-records', { query, limit })
  getTestRecord = (id: number) => this.invoke('get-test-record', id)
  generateReportPdf = (report: any) => this.invoke('generate-report-pdf', { report })
  openReportPreview = (report: any) => this.invoke('open-report-preview', { report })
  // keep above definitions for print/save/recent/search/getTestRecord
  addTestCategory = (category: string) => this.invoke('add-test-category', { category })
  addChildTest = (category: string, parent_id: number, name: string, normal_value?: string | null) =>
    this.invoke('add-child-test', { category, parent_id, name, normal_value })
  updateTestNormal = (id: number, normal_value?: string | null) =>
    this.invoke('update-test-normal', { id, normal_value })
  updateTestRequired = (id: number, required: boolean) => this.invoke('update-test-required', { id, required })
  maintenanceReseedTests = () => this.invoke('maintenance-reseed-tests')
  exportTests = () =>
    this.invoke('export-tests') as Promise<
      {
        category: string
        name: string
        normal_value?: string | null
        result?: string | null
        required?: boolean
        sort_order?: number | null
        parent_id?: number | null
      }[]
    >
  importTests = (
    tests: {
      category: string
      name: string
      normal_value?: string | null
      result?: string | null
      required?: boolean
      sort_order?: number | null
      parent_id?: number | null
    }[]
  ) => this.invoke('import-tests', tests)
  exportLogs = (format: 'json' | 'txt' = 'json') =>
    this.invoke('export-logs', { format }) as Promise<{ filePath: string; count: number }>
  listLogs = (
    options: {
      offset?: number
      limit?: number
      level?: string | null
      action?: string | null
      search?: string | null
    } = {}
  ) =>
    this.invoke('list-logs', {
      offset: options.offset ?? 0,
      limit: options.limit ?? 50,
      level: options.level ?? null,
      action: options.action ?? null,
      search: options.search ?? null,
    }) as Promise<{
      total: number
      rows: { id: number; ts: string; action: string; level: string; message?: string | null; payload?: any }[]
    }>
  resetDatabase = () => this.invoke('reset-database') as Promise<{ reset: boolean }>
}
