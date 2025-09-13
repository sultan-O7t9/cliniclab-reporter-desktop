import { type App } from 'electron'
import { handle } from '@/lib/main/shared'
import { getDb } from '@/lib/main/database'

export const registerAppHandlers = (app: App) => {
  // App operations
  handle('version', () => app.getVersion())
  handle('test-categories', () => {
    const db = getDb()
    const rows = db.prepare('SELECT DISTINCT category FROM test ORDER BY category').all() as { category: string }[]
    return rows.map((r) => r.category)
  })
  handle('tests-by-category', (category: string) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT id, category, name, result, normal_value, timestamp FROM test WHERE category = ? ORDER BY name')
      .all(category)
    return rows as any
  })
}
