/**
 * Database Mock for Pipeline Testing
 * Temporary solution to resolve @/lib/db import errors
 */

// Mock Prisma client interface
const mockPrisma = {
  user: {
    findUnique: () => Promise.resolve(null),
    findMany: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    delete: () => Promise.resolve({}),
  },
  project: {
    findUnique: () => Promise.resolve(null),
    findMany: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    delete: () => Promise.resolve({}),
  },
  videoAsset: {
    findUnique: () => Promise.resolve(null),
    findMany: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    delete: () => Promise.resolve({}),
  },
  comment: {
    findMany: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
  },
  share: {
    findUnique: () => Promise.resolve(null),
    findMany: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
  },
  template: {
    findUnique: () => Promise.resolve(null),
    findMany: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    delete: () => Promise.resolve({}),
  },
  // Generic methods
  $connect: () => Promise.resolve(),
  $disconnect: () => Promise.resolve(),
  $executeRaw: () => Promise.resolve(0),
  $queryRaw: () => Promise.resolve([]),
  $transaction: (fn: any) => fn(mockPrisma),
};

export const prisma = mockPrisma;

// For compatibility with different import patterns
export default mockPrisma;