/**
 * Timecode Utilities
 *
 * CLAUDE.md 준수: shared/lib 레이어 타임코드 유틸리티
 * 타임코드 기반 피드백 시스템을 위한 시간 처리 유틸리티
 */

import type { Timecode } from '../../entities/feedback'

/**
 * 타임코드 정밀도 설정
 */
export const TIMECODE_PRECISION = 0.1 // 0.1초 단위

/**
 * 타임코드 형식 옵션
 */
export interface TimecodeFormatOptions {
  readonly showHours: boolean
  readonly showMilliseconds: boolean
  readonly separator: string
}

/**
 * 타임코드 범위
 */
export interface TimecodeRange {
  readonly start: Timecode
  readonly end: Timecode
  readonly duration: number
}

/**
 * 초를 타임코드 객체로 변환
 */
export function secondsToTimecode(
  seconds: number,
  options: Partial<TimecodeFormatOptions> = {}
): Timecode {
  const opts: TimecodeFormatOptions = {
    showHours: false,
    showMilliseconds: false,
    separator: ':',
    ...options
  }

  // 정밀도에 맞게 반올림
  const roundedSeconds = Math.round(seconds / TIMECODE_PRECISION) * TIMECODE_PRECISION

  const hours = Math.floor(roundedSeconds / 3600)
  const minutes = Math.floor((roundedSeconds % 3600) / 60)
  const secs = Math.floor(roundedSeconds % 60)
  const milliseconds = Math.round((roundedSeconds % 1) * 1000)

  let formatted = ''

  if (opts.showHours || hours > 0) {
    formatted += hours.toString().padStart(2, '0') + opts.separator
  }

  formatted += minutes.toString().padStart(2, '0') + opts.separator
  formatted += secs.toString().padStart(2, '0')

  if (opts.showMilliseconds) {
    formatted += '.' + milliseconds.toString().padStart(3, '0')
  }

  return {
    seconds: roundedSeconds,
    formatted
  }
}

/**
 * 타임코드 문자열을 초로 변환
 */
export function timecodeToSeconds(formatted: string): number {
  // HH:MM:SS, MM:SS, MM:SS.mmm 형식 지원
  const timePattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/
  const match = formatted.match(timePattern)

  if (!match) {
    throw new Error(`잘못된 타임코드 형식: ${formatted}`)
  }

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseInt(match[3], 10)
  const milliseconds = parseInt((match[4] || '0').padEnd(3, '0'), 10)

  if (minutes >= 60 || seconds >= 60 || milliseconds >= 1000) {
    throw new Error(`잘못된 타임코드 값: ${formatted}`)
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

/**
 * 타임코드 형식 검증
 */
export function validateTimecodeFormat(formatted: string): boolean {
  try {
    timecodeToSeconds(formatted)
    return true
  } catch {
    return false
  }
}

/**
 * 타임코드 정규화 (정밀도에 맞게 조정)
 */
export function normalizeTimecode(timecode: Timecode): Timecode {
  return secondsToTimecode(timecode.seconds)
}

/**
 * 두 타임코드 사이의 거리 계산
 */
export function getTimecodeDistance(tc1: Timecode, tc2: Timecode): number {
  return Math.abs(tc1.seconds - tc2.seconds)
}

/**
 * 타임코드가 범위 내에 있는지 확인
 */
export function isTimecodeInRange(
  timecode: Timecode,
  range: TimecodeRange
): boolean {
  return timecode.seconds >= range.start.seconds &&
         timecode.seconds <= range.end.seconds
}

/**
 * 타임코드 범위 생성
 */
export function createTimecodeRange(
  startSeconds: number,
  endSeconds: number
): TimecodeRange {
  const start = secondsToTimecode(Math.min(startSeconds, endSeconds))
  const end = secondsToTimecode(Math.max(startSeconds, endSeconds))

  return {
    start,
    end,
    duration: end.seconds - start.seconds
  }
}

/**
 * 영상 길이에 따른 적절한 타임코드 형식 결정
 */
export function getOptimalTimecodeFormat(videoDuration: number): TimecodeFormatOptions {
  return {
    showHours: videoDuration >= 3600, // 1시간 이상
    showMilliseconds: videoDuration < 60, // 1분 미만
    separator: ':'
  }
}

/**
 * 타임코드 배열을 시간순으로 정렬
 */
export function sortTimecodes(timecodes: Timecode[]): Timecode[] {
  return [...timecodes].sort((a, b) => a.seconds - b.seconds)
}

/**
 * 특정 구간의 타임코드들만 필터링
 */
export function filterTimecodesInRange(
  timecodes: Timecode[],
  range: TimecodeRange
): Timecode[] {
  return timecodes.filter(tc => isTimecodeInRange(tc, range))
}

/**
 * 타임코드 클러스터링 (가까운 타임코드들을 그룹화)
 */
export function clusterTimecodes(
  timecodes: Timecode[],
  maxDistance: number = 5 // 최대 5초 거리
): Timecode[][] {
  if (timecodes.length === 0) return []

  const sorted = sortTimecodes(timecodes)
  const clusters: Timecode[][] = []
  let currentCluster: Timecode[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const distance = getTimecodeDistance(sorted[i], sorted[i - 1])

    if (distance <= maxDistance) {
      currentCluster.push(sorted[i])
    } else {
      clusters.push(currentCluster)
      currentCluster = [sorted[i]]
    }
  }

  clusters.push(currentCluster)
  return clusters
}

/**
 * 타임코드 밀도 계산 (특정 구간에 얼마나 많은 타임코드가 있는지)
 */
export function calculateTimecodeDensity(
  timecodes: Timecode[],
  windowSize: number = 10 // 10초 윈도우
): Array<{ startTime: number; endTime: number; density: number }> {
  if (timecodes.length === 0) return []

  const sorted = sortTimecodes(timecodes)
  const maxTime = sorted[sorted.length - 1].seconds
  const densities: Array<{ startTime: number; endTime: number; density: number }> = []

  for (let start = 0; start <= maxTime; start += windowSize) {
    const end = start + windowSize
    const count = sorted.filter(tc =>
      tc.seconds >= start && tc.seconds < end
    ).length

    densities.push({
      startTime: start,
      endTime: end,
      density: count
    })
  }

  return densities
}

/**
 * 타임코드를 비디오 플레이어용 seek 시간으로 변환
 */
export function timecodeToSeekTime(timecode: Timecode, videoDuration: number): number {
  // 영상 길이를 초과하지 않도록 제한
  return Math.min(timecode.seconds, videoDuration)
}

/**
 * 플레이어 현재 시간을 타임코드로 변환
 */
export function currentTimeToTimecode(currentTime: number): Timecode {
  return secondsToTimecode(currentTime)
}

/**
 * 타임코드 구간을 읽기 쉬운 문자열로 변환
 */
export function formatTimecodeRange(range: TimecodeRange): string {
  const options = getOptimalTimecodeFormat(range.end.seconds)
  const start = secondsToTimecode(range.start.seconds, options)
  const end = secondsToTimecode(range.end.seconds, options)

  return `${start.formatted} - ${end.formatted}`
}

/**
 * 상대 시간 표시 (예: "2분 전", "방금 전")
 */
export function getRelativeTimeString(timecode: Timecode, currentTime: number): string {
  const diff = Math.abs(currentTime - timecode.seconds)

  if (diff < 1) return '지금'
  if (diff < 60) return `${Math.round(diff)}초 ${currentTime > timecode.seconds ? '전' : '후'}`
  if (diff < 3600) return `${Math.round(diff / 60)}분 ${currentTime > timecode.seconds ? '전' : '후'}`

  const hours = Math.round(diff / 3600)
  return `${hours}시간 ${currentTime > timecode.seconds ? '전' : '후'}`
}

/**
 * 타임코드 검색 (가장 가까운 타임코드 찾기)
 */
export function findClosestTimecode(
  targetSeconds: number,
  timecodes: Timecode[]
): Timecode | null {
  if (timecodes.length === 0) return null

  let closest = timecodes[0]
  let minDistance = Math.abs(targetSeconds - closest.seconds)

  for (const tc of timecodes) {
    const distance = Math.abs(targetSeconds - tc.seconds)
    if (distance < minDistance) {
      minDistance = distance
      closest = tc
    }
  }

  return closest
}

/**
 * 타임코드 범위 오버랩 확인
 */
export function rangesOverlap(range1: TimecodeRange, range2: TimecodeRange): boolean {
  return range1.start.seconds < range2.end.seconds &&
         range2.start.seconds < range1.end.seconds
}

/**
 * 타임코드 히트맵 데이터 생성 (시각화용)
 */
export function generateTimecodeHeatmap(
  timecodes: Timecode[],
  videoDuration: number,
  bucketSize: number = 1 // 1초 단위 버킷
): Array<{ time: number; intensity: number }> {
  const buckets = Math.ceil(videoDuration / bucketSize)
  const heatmap: Array<{ time: number; intensity: number }> = []

  for (let i = 0; i < buckets; i++) {
    const bucketStart = i * bucketSize
    const bucketEnd = bucketStart + bucketSize

    const count = timecodes.filter(tc =>
      tc.seconds >= bucketStart && tc.seconds < bucketEnd
    ).length

    heatmap.push({
      time: bucketStart,
      intensity: count
    })
  }

  return heatmap
}

/**
 * 타임코드 퍼센트 위치 계산 (진행바 표시용)
 */
export function getTimecodePercentage(timecode: Timecode, videoDuration: number): number {
  if (videoDuration === 0) return 0
  return Math.min((timecode.seconds / videoDuration) * 100, 100)
}

/**
 * 퍼센트 위치를 타임코드로 변환
 */
export function percentageToTimecode(percentage: number, videoDuration: number): Timecode {
  const seconds = (percentage / 100) * videoDuration
  return secondsToTimecode(seconds)
}

/**
 * 타임코드 유효성 검증 (영상 길이 기준)
 */
export function isValidTimecodeForVideo(timecode: Timecode, videoDuration: number): boolean {
  return timecode.seconds >= 0 &&
         timecode.seconds <= videoDuration &&
         timecode.seconds % TIMECODE_PRECISION === 0
}

/**
 * 키보드 단축키를 위한 타임코드 점프 계산
 */
export function calculateJumpTimecode(
  currentTimecode: Timecode,
  jumpType: 'forward' | 'backward',
  jumpSize: 'small' | 'medium' | 'large',
  videoDuration: number
): Timecode {
  const jumpSizes = {
    small: 5,   // 5초
    medium: 15, // 15초
    large: 30   // 30초
  }

  const jump = jumpSizes[jumpSize]
  const direction = jumpType === 'forward' ? 1 : -1
  const newSeconds = Math.max(0, Math.min(
    currentTimecode.seconds + (jump * direction),
    videoDuration
  ))

  return secondsToTimecode(newSeconds)
}