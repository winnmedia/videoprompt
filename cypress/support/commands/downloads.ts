/**
 * 다운로드 검증 관련 Cypress 커맨드
 * CLAUDE.md 준수: TDD, 예측 가능성
 */

import path from 'path'
import fs from 'fs'

/**
 * 파일 다운로드 검증
 */
Cypress.Commands.add('verifyDownload', (fileName: string, timeout = 10000) => {
  const downloadsFolder = Cypress.config('downloadsFolder')
  const filePath = path.join(downloadsFolder, fileName)

  cy.log(`Verifying download: ${fileName}`)

  // 파일이 존재할 때까지 대기
  cy.readFile(filePath, { timeout }).then((fileContent) => {
    cy.wrap(fileContent).should('not.be.empty')
    cy.log(`✅ Download verified: ${fileName}`)
  })

  // 파일 정보 로깅
  cy.task('log', `Download completed: ${fileName}`)
})

/**
 * 다운로드 폴더 정리
 */
Cypress.Commands.add('cleanupDownloads', () => {
  const downloadsFolder = Cypress.config('downloadsFolder')

  cy.task('log', 'Cleaning up downloads folder')

  // 다운로드 폴더 비우기
  cy.exec(`rm -rf ${downloadsFolder}/*`, { failOnNonZeroExit: false })
})

/**
 * 다운로드 파일 크기 검증
 */
Cypress.Commands.add('verifyDownloadSize', (fileName: string, minSizeBytes: number) => {
  const downloadsFolder = Cypress.config('downloadsFolder')
  const filePath = path.join(downloadsFolder, fileName)

  cy.readFile(filePath, 'binary').then((fileContent) => {
    const fileSize = fileContent.length
    cy.wrap(fileSize).should('be.greaterThan', minSizeBytes)
    cy.log(`✅ File size verified: ${fileSize} bytes (min: ${minSizeBytes})`)
  })
})

// ===========================================
// 글로벌 타입 확장
// ===========================================

declare global {
  namespace Cypress {
    interface Chainable {
      verifyDownload(fileName: string, timeout?: number): Chainable<void>
      cleanupDownloads(): Chainable<void>
      verifyDownloadSize(fileName: string, minSizeBytes: number): Chainable<void>
    }
  }
}

export {}