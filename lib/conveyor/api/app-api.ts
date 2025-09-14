import { ConveyorApi } from '@/lib/preload/shared'

export class AppApi extends ConveyorApi {
  version = () => this.invoke('version')
  testCategories = () => this.invoke('test-categories')
  testsByCategory = (category: string) => this.invoke('tests-by-category', category)
  saveTestRecord = (payload: any) => this.invoke('save-test-record', payload)
  generateReportPdf = (report: any) => this.invoke('generate-report-pdf', { report })
  openReportPreview = (report: any) => this.invoke('open-report-preview', { report })
  printReport = (report: any) => this.invoke('print-report', { report })
  recentTestRecords = (limit = 50) => this.invoke('recent-test-records', { limit })
  searchTestRecords = (query: string, limit = 50) => this.invoke('search-test-records', { query, limit })
  getTestRecord = (id: number) => this.invoke('get-test-record', id)
  allTestsGrouped = () => this.invoke('all-tests-grouped')
  addTestCategory = (category: string) => this.invoke('add-test-category', { category })
  addTest = (category: string, name: string, normal_value?: string | null) =>
    this.invoke('add-test', { category, name, normal_value })
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
      }[]
    >
  importTests = (
    tests: {
      category: string
      name: string
      normal_value?: string | null
      result?: string | null
      required?: boolean
    }[]
  ) => this.invoke('import-tests', tests)
}
