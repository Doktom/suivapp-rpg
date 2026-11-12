import { createClient } from '@supabase/supabase-js'

export type Table =
  | 'families'
  | 'habit_templates'
  | 'habits'
  | 'validations'
  | 'slips'
  | 'task_lists'
  | 'tasks'
  | 'checklists'
  | 'events'
  | 'profile'
  | 'training_exercises'
  | 'training_sessions'
  | 'training_wods'
  | 'training_logs'
  | 'training_goals'
  | 'dance_classes'
  | 'dance_sessions'
  | 'dance_figures'
  | 'dance_goals'
export type Row = { id: string }

export interface Repo {
  list<T extends Row>(table: Table): Promise<T[]>
  upsert(table: Table, row: Row): Promise<void>
  remove(table: Table, id: string): Promise<void>
  /** Delete every row whose `column` equals `value`. */
  removeWhere(table: Table, column: string, value: string): Promise<void>
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const isDemo = supabase === null

const supabaseRepo = (client: NonNullable<typeof supabase>): Repo => ({
  async list<T extends Row>(table: Table) {
    const { data, error } = await client.from(table).select('*')
    if (error) throw error
    return data as T[]
  },
  async upsert(table, row) {
    const { error } = await client.from(table).upsert(row)
    if (error) throw error
  },
  async remove(table, id) {
    const { error } = await client.from(table).delete().eq('id', id)
    if (error) throw error
  },
  async removeWhere(table, column, value) {
    const { error } = await client.from(table).delete().eq(column, value)
    if (error) throw error
  },
})

const storageKey = (table: Table) => `suivapp-rpg:${table}`
const read = (table: Table): Row[] => JSON.parse(localStorage.getItem(storageKey(table)) ?? '[]')
const write = (table: Table, rows: Row[]) => localStorage.setItem(storageKey(table), JSON.stringify(rows))

const localRepo: Repo = {
  async list<T extends Row>(table: Table) {
    return read(table) as T[]
  },
  async upsert(table, row) {
    write(table, [...read(table).filter((r) => r.id !== row.id), row])
  },
  async remove(table, id) {
    write(table, read(table).filter((r) => r.id !== id))
  },
  async removeWhere(table, column, value) {
    write(table, read(table).filter((r) => (r as Record<string, unknown>)[column] !== value))
  },
}

export const repo: Repo = supabase ? supabaseRepo(supabase) : localRepo
