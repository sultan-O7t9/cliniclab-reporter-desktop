import { ConveyorApi } from '@/lib/preload/shared'

export class AppApi extends ConveyorApi {
  version = () => this.invoke('version')
  testCategories = () => this.invoke('test-categories')
  testsByCategory = (category: string) => this.invoke('tests-by-category', category)
  saveTestRecord = (payload: any) => this.invoke('save-test-record', payload)
  generateReportPdf = (report: any) => this.invoke('generate-report-pdf', { report })
}
