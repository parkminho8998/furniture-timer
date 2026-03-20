export interface Step {
  id: number
  name: string
  emoji: string
  totalSeconds: number
  timeLeft: number
  running: boolean
  done: boolean
  parallel: boolean
  startedAt?: number
  finishedAt?: number
  elapsedSeconds?: number
}

export interface ProjectRecord {
  id: string
  date: string
  name: string
  steps: {
    name: string
    elapsedSeconds: number
  }[]
  totalSeconds: number
  limitSeconds: number
}