import type { ProjectRecord, Step } from './types'

const KEY = 'juhi-projects'
const PROGRESS_KEY = 'juhi-progress-list'

export function saveProject(record: ProjectRecord) {
  const existing = loadProjects()
  existing.push(record)
  localStorage.setItem(KEY, JSON.stringify(existing))
}

export function loadProjects(): ProjectRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

export function deleteProject(id: string) {
  const existing = loadProjects().filter(p => p.id !== id)
  localStorage.setItem(KEY, JSON.stringify(existing))
}

export interface Progress {
  id: string
  projectName: string
  steps: Step[]
  limitLeft: number
  savedAt: string
}

export function saveProgress(progress: Omit<Progress, 'id'>) {
  const list = loadProgressList()
  const newEntry: Progress = { ...progress, id: Date.now().toString() }
  // 같은 프로젝트 이름이면 덮어쓰기, 아니면 앞에 추가
  const exists = list.findIndex(p => p.projectName === progress.projectName)
  if (exists >= 0) {
    list[exists] = newEntry
  } else {
    list.unshift(newEntry)
  }
  // 최대 3개만 유지
  const trimmed = list.slice(0, 3)
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(trimmed))
}

export function loadProgressList(): Progress[] {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]') }
  catch { return [] }
}

export function deleteProgress(id: string) {
  const list = loadProgressList().filter(p => p.id !== id)
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(list))
}

export function clearProgress() {
  localStorage.removeItem(PROGRESS_KEY)
}

// 하위 호환용
export function loadProgress(): Progress | null {
  const list = loadProgressList()
  return list.length > 0 ? list[0] : null
}