/**
 * Jest polyfills for MSW and Node.js compatibility
 */

const { TextEncoder, TextDecoder } = require('util')
const { ReadableStream, WritableStream, TransformStream } = require('stream/web')

// MSW polyfills
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Web Streams API polyfills (Node.js 18+)
global.ReadableStream = ReadableStream
global.WritableStream = WritableStream
global.TransformStream = TransformStream

// Performance API polyfill
if (!global.performance) {
  global.performance = require('perf_hooks').performance
}

// URL polyfill for older Node.js versions
if (!global.URL) {
  global.URL = require('url').URL
}

// EventEmitter polyfill for MSW
const { EventEmitter } = require('events')
if (!global.EventEmitter) {
  global.EventEmitter = EventEmitter
}

// process polyfill for MSW
if (!global.process) {
  global.process = process
}