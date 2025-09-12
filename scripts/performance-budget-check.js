#!/usr/bin/env node

/**
 * 성능 예산 검증 스크립트
 * 
 * CI/CD 파이프라인에서 실행되어 성능 예산을 검증합니다.
 * Lighthouse CI와 번들 크기를 검사하여 성능 회귀를 방지합니다.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 성능 예산 설정
const PERFORMANCE_BUDGET = {
  // Lighthouse 점수 (0-100)
  lighthouse: {
    performance: 90,
    accessibility: 95,
    bestPractices: 90,
    seo: 90
  },
  
  // Core Web Vitals (ms)
  coreWebVitals: {
    lcp: 2500,      // Largest Contentful Paint
    inp: 200,       // Interaction to Next Paint  
    cls: 0.1        // Cumulative Layout Shift
  },
  
  // 번들 크기 (bytes)
  bundleSize: {
    javascript: 1024 * 1024,      // 1MB
    css: 256 * 1024,              // 256KB
    total: 2 * 1024 * 1024        // 2MB
  },
  
  // API 응답 시간 (ms)
  api: {
    averageResponseTime: 100,
    maxResponseTime: 1000
  }
}

// 색상 출력 유틸리티
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${msg}${colors.reset}`)
}

/**
 * Lighthouse CI 결과 분석
 */
async function checkLighthouseResults() {
  log.header('🔍 Checking Lighthouse Results')
  
  const lhciResultsPath = path.join(process.cwd(), '.lighthouseci')
  
  if (!fs.existsSync(lhciResultsPath)) {
    log.warning('Lighthouse CI results not found. Running Lighthouse...')
    
    try {
      execSync('npx @lhci/cli autorun', { stdio: 'inherit' })
    } catch (error) {
      log.error('Failed to run Lighthouse CI')
      return false
    }
  }
  
  // Lighthouse 결과 파일 찾기
  const resultsDir = fs.readdirSync(lhciResultsPath)
    .find(dir => dir.startsWith('lhr-'))
  
  if (!resultsDir) {
    log.error('No Lighthouse results found')
    return false
  }
  
  const resultFiles = fs.readdirSync(path.join(lhciResultsPath, resultsDir))
    .filter(file => file.endsWith('.json'))
  
  if (resultFiles.length === 0) {
    log.error('No Lighthouse result files found')
    return false
  }
  
  let allPassed = true
  
  for (const file of resultFiles) {
    const resultPath = path.join(lhciResultsPath, resultsDir, file)
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
    
    const { categories, audits } = result
    const url = result.finalUrl || result.requestedUrl
    
    log.info(`Analyzing results for: ${url}`)
    
    // Lighthouse 점수 검사
    const scores = {
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      bestPractices: Math.round(categories['best-practices'].score * 100),
      seo: Math.round(categories.seo.score * 100)
    }
    
    for (const [category, score] of Object.entries(scores)) {
      const threshold = PERFORMANCE_BUDGET.lighthouse[category]
      
      if (score >= threshold) {
        log.success(`${category}: ${score}/100 (>= ${threshold})`)
      } else {
        log.error(`${category}: ${score}/100 (< ${threshold})`)
        allPassed = false
      }
    }
    
    // Core Web Vitals 검사
    const cwv = {
      lcp: audits['largest-contentful-paint']?.numericValue || 0,
      inp: audits['interaction-to-next-paint']?.numericValue || 0,
      cls: audits['cumulative-layout-shift']?.numericValue || 0
    }
    
    for (const [metric, value] of Object.entries(cwv)) {
      const threshold = PERFORMANCE_BUDGET.coreWebVitals[metric]
      const displayValue = metric === 'cls' ? value.toFixed(3) : Math.round(value)
      const displayThreshold = metric === 'cls' ? threshold : `${threshold}ms`
      
      if (value <= threshold) {
        log.success(`${metric.toUpperCase()}: ${displayValue} (<= ${displayThreshold})`)
      } else {
        log.error(`${metric.toUpperCase()}: ${displayValue} (> ${displayThreshold})`)
        allPassed = false
      }
    }
    
    console.log('') // 빈 줄
  }
  
  return allPassed
}

/**
 * 번들 크기 검사
 */
function checkBundleSize() {
  log.header('📦 Checking Bundle Size')
  
  const buildDir = path.join(process.cwd(), '.next')
  const staticDir = path.join(buildDir, 'static')
  
  if (!fs.existsSync(staticDir)) {
    log.error('.next/static directory not found. Run build first.')
    return false
  }
  
  let totalSize = 0
  let jsSize = 0
  let cssSize = 0
  let allPassed = true
  
  // 재귀적으로 파일 크기 계산
  function calculateSize(dir, extensions) {
    let size = 0
    
    if (!fs.existsSync(dir)) return size
    
    const files = fs.readdirSync(dir)
    
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory()) {
        size += calculateSize(filePath, extensions)
      } else if (extensions.some(ext => file.endsWith(ext))) {
        size += stat.size
      }
    }
    
    return size
  }
  
  // JavaScript 파일 크기
  jsSize = calculateSize(staticDir, ['.js'])
  
  // CSS 파일 크기  
  cssSize = calculateSize(staticDir, ['.css'])
  
  totalSize = jsSize + cssSize
  
  // 크기 검증
  const formatSize = (bytes) => {
    const kb = bytes / 1024
    const mb = kb / 1024
    
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    return `${kb.toFixed(2)} KB`
  }
  
  // JavaScript 번들 크기 검사
  if (jsSize <= PERFORMANCE_BUDGET.bundleSize.javascript) {
    log.success(`JavaScript: ${formatSize(jsSize)} (<= ${formatSize(PERFORMANCE_BUDGET.bundleSize.javascript)})`)
  } else {
    log.error(`JavaScript: ${formatSize(jsSize)} (> ${formatSize(PERFORMANCE_BUDGET.bundleSize.javascript)})`)
    allPassed = false
  }
  
  // CSS 번들 크기 검사
  if (cssSize <= PERFORMANCE_BUDGET.bundleSize.css) {
    log.success(`CSS: ${formatSize(cssSize)} (<= ${formatSize(PERFORMANCE_BUDGET.bundleSize.css)})`)
  } else {
    log.error(`CSS: ${formatSize(cssSize)} (> ${formatSize(PERFORMANCE_BUDGET.bundleSize.css)})`)
    allPassed = false
  }
  
  // 총 번들 크기 검사
  if (totalSize <= PERFORMANCE_BUDGET.bundleSize.total) {
    log.success(`Total: ${formatSize(totalSize)} (<= ${formatSize(PERFORMANCE_BUDGET.bundleSize.total)})`)
  } else {
    log.error(`Total: ${formatSize(totalSize)} (> ${formatSize(PERFORMANCE_BUDGET.bundleSize.total)})`)
    allPassed = false
  }
  
  return allPassed
}

/**
 * API 성능 검사 (프로덕션 환경에서)
 */
async function checkApiPerformance() {
  log.header('🚀 Checking API Performance')
  
  const apiEndpoints = [
    '/api/health',
    '/api/auth/me'
  ]
  
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000'
  let allPassed = true
  
  for (const endpoint of apiEndpoints) {
    try {
      const startTime = Date.now()
      const response = await fetch(`${baseUrl}${endpoint}`)
      const endTime = Date.now()
      const responseTime = endTime - startTime
      
      if (response.ok) {
        if (responseTime <= PERFORMANCE_BUDGET.api.averageResponseTime) {
          log.success(`${endpoint}: ${responseTime}ms (<= ${PERFORMANCE_BUDGET.api.averageResponseTime}ms)`)
        } else if (responseTime <= PERFORMANCE_BUDGET.api.maxResponseTime) {
          log.warning(`${endpoint}: ${responseTime}ms (> ${PERFORMANCE_BUDGET.api.averageResponseTime}ms, <= ${PERFORMANCE_BUDGET.api.maxResponseTime}ms)`)
        } else {
          log.error(`${endpoint}: ${responseTime}ms (> ${PERFORMANCE_BUDGET.api.maxResponseTime}ms)`)
          allPassed = false
        }
      } else {
        log.error(`${endpoint}: HTTP ${response.status}`)
        allPassed = false
      }
    } catch (error) {
      log.error(`${endpoint}: ${error.message}`)
      allPassed = false
    }
  }
  
  return allPassed
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log(`${colors.bold}🎯 Performance Budget Check${colors.reset}\n`)
  
  const checks = []
  const args = process.argv.slice(2)
  
  // 검사할 항목 결정
  if (args.length === 0 || args.includes('--all')) {
    checks.push(
      { name: 'Lighthouse', fn: checkLighthouseResults },
      { name: 'Bundle Size', fn: checkBundleSize },
      { name: 'API Performance', fn: checkApiPerformance }
    )
  } else {
    if (args.includes('--lighthouse')) {
      checks.push({ name: 'Lighthouse', fn: checkLighthouseResults })
    }
    if (args.includes('--bundle')) {
      checks.push({ name: 'Bundle Size', fn: checkBundleSize })
    }
    if (args.includes('--api')) {
      checks.push({ name: 'API Performance', fn: checkApiPerformance })
    }
  }
  
  let allChecksPassed = true
  
  // 각 검사 실행
  for (const check of checks) {
    try {
      const passed = await check.fn()
      if (!passed) {
        allChecksPassed = false
      }
    } catch (error) {
      log.error(`${check.name} check failed: ${error.message}`)
      allChecksPassed = false
    }
  }
  
  // 최종 결과
  console.log('\n' + '='.repeat(60))
  
  if (allChecksPassed) {
    log.success('🎉 All performance budget checks passed!')
    process.exit(0)
  } else {
    log.error('❌ Performance budget checks failed!')
    console.log('\n💡 Tips to improve performance:')
    console.log('  - Enable code splitting and lazy loading')
    console.log('  - Optimize images and fonts')
    console.log('  - Remove unused dependencies')
    console.log('  - Use performance profiling tools')
    console.log('  - Consider using a CDN')
    
    process.exit(1)
  }
}

// 도움말
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🎯 Performance Budget Check

Usage:
  node scripts/performance-budget-check.js [options]

Options:
  --all          Run all checks (default)
  --lighthouse   Run Lighthouse checks only
  --bundle       Run bundle size checks only  
  --api          Run API performance checks only
  --help, -h     Show this help message

Environment Variables:
  TEST_URL       Base URL for API tests (default: http://localhost:3000)

Examples:
  node scripts/performance-budget-check.js
  node scripts/performance-budget-check.js --lighthouse --bundle
  TEST_URL=https://myapp.vercel.app node scripts/performance-budget-check.js --api
`)
  process.exit(0)
}

// 스크립트 실행
main().catch(error => {
  log.error(`Script failed: ${error.message}`)
  process.exit(1)
})