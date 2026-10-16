// 会話のログ（いま遊んでいる間だけ覚えておく）
export interface LogLine {
  speaker?: string
  text: string
  choice?: boolean
}
export const LOG: LogLine[] = []
const LOG_MAX = 200
export function pushLog(line: LogLine): void {
  const prev = LOG[LOG.length - 1]
  if (prev && prev.text === line.text && prev.speaker === line.speaker) return
  LOG.push(line)
  if (LOG.length > LOG_MAX) LOG.splice(0, LOG.length - LOG_MAX)
}
