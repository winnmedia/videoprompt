# Phase 3.9 성능 최적화 및 보안 전략

## 📋 개요

Phase 3.9 영상 피드백 기능 확장에 따른 성능 최적화 및 보안 강화 전략

## 🚀 성능 최적화 전략

### 1. 프론트엔드 성능 최적화

#### 1.1 번들 크기 최적화
```typescript
// 동적 임포트를 통한 코드 스플리팅
const EnhancedShareModal = lazy(() => import('./EnhancedShareModal'));
const VersionSwitcher = lazy(() => import('./VersionSwitcher'));
const EnhancedCommentThread = lazy(() => import('./EnhancedCommentThread'));

// 트리 셰이킹 최적화
export {
  // 필요한 것만 export
  useVersionManager,
  useEnhancedComments,
  useAdvancedSharing
} from './hooks';

// Webpack Bundle Analyzer 설정
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@heroicons/react']
  }
});
```

#### 1.2 메모이제이션 전략
```typescript
// React.memo로 컴포넌트 최적화
export const CommentItem = React.memo(function CommentItem({
  comment,
  onReaction,
  onReply
}: CommentItemProps) {
  // 렌더링 최적화된 로직
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수로 불필요한 리렌더링 방지
  return (
    prevProps.comment.id === nextProps.comment.id &&
    prevProps.comment.content === nextProps.comment.content &&
    prevProps.comment.reactions.length === nextProps.comment.reactions.length
  );
});

// useMemo로 계산 최적화
const memoizedCommentTree = useMemo(() => {
  return buildCommentThreads(filteredComments);
}, [filteredComments, sortOption]);

// useCallback로 함수 최적화
const handleReaction = useCallback((commentId: string, type: EmotionType) => {
  // API 호출 최적화
}, []);
```

#### 1.3 가상화 및 무한 스크롤
```typescript
// 댓글 목록 가상화
import { FixedSizeList as List } from 'react-window';

function VirtualizedCommentList({ comments }: { comments: ThreadedComment[] }) {
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <CommentItem comment={comments[index]} />
    </div>
  ), [comments]);

  return (
    <List
      height={600}
      itemCount={comments.length}
      itemSize={120}
      overscanCount={5}
    >
      {Row}
    </List>
  );
}

// 무한 스크롤 구현
function useInfiniteComments(sessionId: string) {
  const [comments, setComments] = useState<ThreadedComment[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;

    const response = await fetch(
      `/api/feedback/sessions/${sessionId}/comments/threaded?page=${page}&limit=20`
    );
    const data = await response.json();

    setComments(prev => [...prev, ...data.comments]);
    setHasMore(data.pagination.hasNext);
    setPage(prev => prev + 1);
  }, [sessionId, page, hasMore]);

  return { comments, loadMore, hasMore };
}
```

#### 1.4 이미지 최적화
```typescript
// Next.js Image 컴포넌트 활용
import Image from 'next/image';

function OptimizedThumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={320}
      height={180}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD..." // 작은 블러 이미지
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
}

// 스크린샷 WebP 변환
async function optimizeScreenshot(originalUrl: string): Promise<string> {
  const response = await fetch('/api/image/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: originalUrl,
      format: 'webp',
      quality: 80,
      width: 1920
    })
  });

  const { optimizedUrl } = await response.json();
  return optimizedUrl;
}
```

### 2. 백엔드 성능 최적화

#### 2.1 데이터베이스 최적화
```sql
-- 복합 인덱스 최적화
CREATE INDEX CONCURRENTLY idx_feedback_comments_optimized
ON feedback_comments(session_id, thread_id, depth, created_at)
WHERE is_resolved = false;

-- 파티셔닝으로 대용량 테이블 관리
CREATE TABLE share_access_logs_y2025m01 PARTITION OF share_access_logs
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 구체화된 뷰로 통계 성능 개선
CREATE MATERIALIZED VIEW session_stats AS
SELECT
  s.id as session_id,
  COUNT(DISTINCT c.id) as total_comments,
  COUNT(DISTINCT v.id) as total_versions,
  COUNT(DISTINCT st.token) as total_shares,
  MAX(c.created_at) as last_comment_at
FROM feedback_sessions s
LEFT JOIN feedback_comments c ON c.session_id = s.id
LEFT JOIN video_versions v ON v.session_id = s.id
LEFT JOIN share_permissions sp ON sp.session_id = s.id
LEFT JOIN share_tokens st ON st.permission_id = sp.id
GROUP BY s.id;

-- 자동 갱신 트리거
CREATE OR REPLACE FUNCTION refresh_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY session_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

#### 2.2 API 응답 최적화
```typescript
// GraphQL 스타일 필드 선택
interface CommentQueryOptions {
  includeReactions?: boolean;
  includeAttachments?: boolean;
  includeEditHistory?: boolean;
  fields?: string[];
}

async function getComments(
  sessionId: string,
  options: CommentQueryOptions = {}
): Promise<ThreadedComment[]> {
  const select = buildSelectClause(options.fields);

  const query = `
    SELECT ${select}
    FROM feedback_comments c
    ${options.includeReactions ? 'LEFT JOIN emotion_reactions er ON er.comment_id = c.id' : ''}
    ${options.includeAttachments ? 'LEFT JOIN comment_attachments ca ON ca.comment_id = c.id' : ''}
    WHERE c.session_id = $1
    ORDER BY c.created_at ASC
  `;

  return await db.query(query, [sessionId]);
}

// 응답 압축
import compression from 'compression';

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    // JSON 응답만 압축
    return res.getHeader('content-type')?.includes('application/json');
  }
}));
```

#### 2.3 캐싱 전략
```typescript
// Redis 캐싱 구현
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

class FeedbackCache {
  private static readonly CACHE_TTL = 300; // 5분

  static async getComments(sessionId: string): Promise<ThreadedComment[] | null> {
    const key = `comments:${sessionId}`;
    const cached = await redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  static async setComments(sessionId: string, comments: ThreadedComment[]): Promise<void> {
    const key = `comments:${sessionId}`;
    await redis.setex(key, this.CACHE_TTL, JSON.stringify(comments));
  }

  static async invalidateSession(sessionId: string): Promise<void> {
    const pattern = `*:${sessionId}*`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// CDN 캐싱 헤더
app.get('/api/feedback/sessions/:id/comments', async (req, res) => {
  // 5분 브라우저 캐시, 1시간 CDN 캐시
  res.set({
    'Cache-Control': 'public, max-age=300, s-maxage=3600',
    'ETag': generateETag(req.params.id),
    'Last-Modified': new Date().toUTCString()
  });

  // 데이터 반환
});
```

### 3. 파일 처리 최적화

#### 3.1 영상 업로드 최적화
```typescript
// 청크 업로드 구현
class ChunkedUpload {
  private static readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  static async uploadFile(file: File, onProgress: (progress: number) => void): Promise<string> {
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
    const uploadId = crypto.randomUUID();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      await this.uploadChunk(uploadId, chunkIndex, chunk);
      onProgress((chunkIndex + 1) / totalChunks * 100);
    }

    return await this.completeUpload(uploadId);
  }

  private static async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunk: Blob
  ): Promise<void> {
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('chunk', chunk);

    const response = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.statusText}`);
    }
  }
}

// 서버 사이드 청크 처리
app.post('/api/upload/chunk', async (req, res) => {
  const { uploadId, chunkIndex } = req.body;
  const chunk = req.file;

  // 임시 저장
  const chunkPath = `/tmp/uploads/${uploadId}_${chunkIndex}`;
  await fs.writeFile(chunkPath, chunk.buffer);

  res.json({ success: true });
});

app.post('/api/upload/complete', async (req, res) => {
  const { uploadId } = req.body;

  // 청크 병합
  const chunks = await fs.readdir(`/tmp/uploads/`)
    .then(files => files
      .filter(f => f.startsWith(uploadId))
      .sort((a, b) => {
        const aIndex = parseInt(a.split('_')[1]);
        const bIndex = parseInt(b.split('_')[1]);
        return aIndex - bIndex;
      })
    );

  // 최종 파일 생성
  const finalPath = `/uploads/${uploadId}.mp4`;
  const writeStream = fs.createWriteStream(finalPath);

  for (const chunkFile of chunks) {
    const chunkData = await fs.readFile(`/tmp/uploads/${chunkFile}`);
    writeStream.write(chunkData);
    await fs.unlink(`/tmp/uploads/${chunkFile}`); // 임시 파일 삭제
  }

  writeStream.end();
  res.json({ fileUrl: finalPath });
});
```

#### 3.2 이미지 처리 최적화
```typescript
// Sharp를 이용한 이미지 최적화
import sharp from 'sharp';

class ImageProcessor {
  static async optimizeScreenshot(
    inputBuffer: Buffer,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    }
  ): Promise<Buffer> {
    let pipeline = sharp(inputBuffer);

    // 리사이징
    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // 포맷 및 품질 설정
    switch (options.format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: options.quality || 80 });
        break;
      case 'png':
        pipeline = pipeline.png({ quality: options.quality || 80 });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality: options.quality || 80 });
        break;
    }

    return await pipeline.toBuffer();
  }

  static async generateThumbnail(videoPath: string): Promise<string> {
    const thumbnailPath = videoPath.replace('.mp4', '_thumb.jpg');

    await sharp()
      .extract({ left: 0, top: 0, width: 1920, height: 1080 })
      .resize(320, 180)
      .jpeg({ quality: 75 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  }
}
```

### 4. 실시간 통신 최적화

#### 4.1 WebSocket 최적화
```typescript
// 연결 풀링 및 재사용
class WebSocketManager {
  private static connections = new Map<string, WebSocket>();
  private static readonly MAX_CONNECTIONS = 1000;

  static getConnection(sessionId: string): WebSocket | null {
    return this.connections.get(sessionId) || null;
  }

  static createConnection(sessionId: string, userId: string): WebSocket {
    // 기존 연결 정리
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      this.cleanupOldConnections();
    }

    const ws = new WebSocket(`wss://api.videoprompt.com/feedback/realtime`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth',
        sessionId,
        userId
      }));
    };

    // 하트비트 구현
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    ws.onclose = () => {
      clearInterval(heartbeat);
      this.connections.delete(sessionId);
    };

    this.connections.set(sessionId, ws);
    return ws;
  }

  private static cleanupOldConnections(): void {
    for (const [sessionId, ws] of this.connections.entries()) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.connections.delete(sessionId);
      }
    }
  }
}

// 메시지 배칭으로 네트워크 최적화
class MessageBatcher {
  private pending = new Map<string, any[]>();
  private timers = new Map<string, NodeJS.Timeout>();

  addMessage(sessionId: string, message: any): void {
    if (!this.pending.has(sessionId)) {
      this.pending.set(sessionId, []);
    }

    this.pending.get(sessionId)!.push(message);

    // 100ms 후 일괄 전송
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId)!);
    }

    this.timers.set(sessionId, setTimeout(() => {
      this.flushMessages(sessionId);
    }, 100));
  }

  private flushMessages(sessionId: string): void {
    const messages = this.pending.get(sessionId);
    if (!messages || messages.length === 0) return;

    const ws = WebSocketManager.getConnection(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'batch',
        messages
      }));
    }

    this.pending.delete(sessionId);
    this.timers.delete(sessionId);
  }
}
```

## 🛡️ 보안 전략

### 1. 인증 및 권한 관리

#### 1.1 JWT 토큰 보안
```typescript
// JWT 토큰 생성 및 검증
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface TokenPayload {
  userId: string;
  sessionId?: string;
  permissions: string[];
  iat: number;
  exp: number;
}

class TokenManager {
  private static readonly SECRET = process.env.JWT_SECRET!;
  private static readonly REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private static readonly ACCESS_TOKEN_TTL = 15 * 60; // 15분
  private static readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7일

  static generateTokenPair(userId: string, permissions: string[]) {
    const accessToken = jwt.sign(
      { userId, permissions, type: 'access' },
      this.SECRET,
      { expiresIn: this.ACCESS_TOKEN_TTL }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh', jti: crypto.randomUUID() },
      this.REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_TTL }
    );

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.SECRET) as TokenPayload;
  }

  static verifyRefreshToken(token: string): { userId: string; jti: string } {
    return jwt.verify(token, this.REFRESH_SECRET) as { userId: string; jti: string };
  }
}

// 토큰 블랙리스트 관리
class TokenBlacklist {
  private static blacklistedTokens = new Set<string>();

  static async addToBlacklist(jti: string, expiresAt: Date): Promise<void> {
    this.blacklistedTokens.add(jti);

    // Redis에도 저장 (분산 환경 지원)
    await redis.setex(`blacklist:${jti}`,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      'true'
    );
  }

  static async isBlacklisted(jti: string): Promise<boolean> {
    if (this.blacklistedTokens.has(jti)) {
      return true;
    }

    const redisResult = await redis.get(`blacklist:${jti}`);
    return redisResult === 'true';
  }
}
```

#### 1.2 권한 기반 접근 제어 (RBAC)
```typescript
// 권한 정의
enum Permission {
  VIEW_FEEDBACK = 'feedback:view',
  CREATE_COMMENT = 'feedback:comment:create',
  EDIT_COMMENT = 'feedback:comment:edit',
  DELETE_COMMENT = 'feedback:comment:delete',
  MANAGE_VERSIONS = 'feedback:version:manage',
  CREATE_SHARE_LINK = 'feedback:share:create',
  ADMIN_SESSION = 'feedback:session:admin'
}

enum Role {
  GUEST = 'guest',
  MEMBER = 'member',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  OWNER = 'owner'
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.GUEST]: [Permission.VIEW_FEEDBACK],
  [Role.MEMBER]: [
    Permission.VIEW_FEEDBACK,
    Permission.CREATE_COMMENT
  ],
  [Role.MODERATOR]: [
    Permission.VIEW_FEEDBACK,
    Permission.CREATE_COMMENT,
    Permission.EDIT_COMMENT,
    Permission.DELETE_COMMENT
  ],
  [Role.ADMIN]: [
    Permission.VIEW_FEEDBACK,
    Permission.CREATE_COMMENT,
    Permission.EDIT_COMMENT,
    Permission.DELETE_COMMENT,
    Permission.MANAGE_VERSIONS,
    Permission.CREATE_SHARE_LINK
  ],
  [Role.OWNER]: Object.values(Permission)
};

// 권한 검사 미들웨어
function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = req.user?.permissions || [];

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '권한이 없습니다',
          required: permission
        }
      });
    }

    next();
  };
}

// 세션별 동적 권한 확인
async function checkSessionPermission(
  userId: string,
  sessionId: string,
  permission: Permission
): Promise<boolean> {
  // 세션 참여자 정보 조회
  const participant = await db.query(`
    SELECT fp.permissions, fp.role
    FROM feedback_participants fp
    WHERE fp.user_id = $1 AND fp.session_id = $2
  `, [userId, sessionId]);

  if (!participant) {
    return false;
  }

  const userRole = participant.role as Role;
  const rolePermissions = ROLE_PERMISSIONS[userRole];

  return rolePermissions.includes(permission);
}
```

### 2. 입력 검증 및 데이터 무결성

#### 2.1 Zod 스키마 검증
```typescript
import { z } from 'zod';

// 댓글 생성 스키마
const CreateCommentSchema = z.object({
  sessionId: z.string().uuid(),
  videoSlot: z.enum(['v1', 'v2', 'v3']),
  content: z.string()
    .min(1, '댓글 내용은 필수입니다')
    .max(2000, '댓글은 최대 2000자까지 입력 가능합니다')
    .refine(content => !content.includes('<script'), '스크립트 태그는 허용되지 않습니다'),
  timecode: z.object({
    seconds: z.number().min(0).max(7200), // 최대 2시간
    formatted: z.string().regex(/^\d{1,2}:\d{2}$/)
  }),
  parentId: z.string().uuid().optional(),
  mentionUserIds: z.array(z.string().uuid()).max(10).optional()
});

// 파일 업로드 스키마
const FileUploadSchema = z.object({
  file: z.object({
    size: z.number().max(300 * 1024 * 1024, '파일 크기는 300MB를 초과할 수 없습니다'),
    type: z.string().refine(type =>
      ['video/mp4', 'video/webm', 'video/quicktime'].includes(type),
      '지원하지 않는 파일 형식입니다'
    ),
    name: z.string().max(255, '파일명이 너무 깁니다')
  }),
  replaceReason: z.string().max(500).optional()
});

// 검증 미들웨어
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '입력 데이터가 유효하지 않습니다',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          }
        });
      }
      throw error;
    }
  };
}
```

#### 2.2 SQL 인젝션 방지
```typescript
// Prepared Statement 사용
class SafeDatabase {
  static async getComments(sessionId: string, options: CommentQueryOptions) {
    // 매개변수화된 쿼리 사용
    const query = `
      SELECT c.id, c.content, c.created_at, c.author_name
      FROM feedback_comments c
      WHERE c.session_id = $1
      AND ($2::boolean IS NULL OR c.is_resolved = $2)
      ORDER BY c.created_at ASC
      LIMIT $3 OFFSET $4
    `;

    return await db.query(query, [
      sessionId,
      options.includeResolved ?? null,
      options.limit || 20,
      options.offset || 0
    ]);
  }

  // 동적 쿼리 빌더 (안전한 방식)
  static buildSafeQuery(baseQuery: string, filters: Record<string, any>) {
    const allowedFilters = ['is_resolved', 'video_slot', 'author_id'];
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (allowedFilters.includes(key) && value !== undefined) {
        conditions.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return {
      query: `${baseQuery} ${whereClause}`,
      values
    };
  }
}
```

### 3. 파일 보안

#### 3.1 파일 업로드 보안
```typescript
import multer from 'multer';
import path from 'path';
import { createHash } from 'crypto';

// 안전한 파일 업로드 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // MIME 타입 검증
    const allowedMimes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo'
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('지원하지 않는 파일 형식입니다'));
    }

    // 파일 확장자 검증
    const allowedExtensions = ['.mp4', '.webm', '.mov', '.avi'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('지원하지 않는 파일 확장자입니다'));
    }

    cb(null, true);
  }
});

// 파일 내용 검증
class FileValidator {
  static async validateVideoFile(buffer: Buffer): Promise<boolean> {
    // 파일 시그니처 확인
    const mp4Signature = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const webmSignature = Buffer.from([0x1A, 0x45, 0xDF, 0xA3]);

    const header = buffer.slice(0, 20);

    return header.includes(mp4Signature) || header.includes(webmSignature);
  }

  static generateSecureFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const hash = createHash('md5').update(originalName + Date.now()).digest('hex');
    return `${hash}${ext}`;
  }

  static async scanForMalware(filePath: string): Promise<boolean> {
    // ClamAV 또는 다른 바이러스 검사 도구 연동
    try {
      const { exec } = require('child_process');
      const result = await new Promise((resolve, reject) => {
        exec(`clamscan --no-summary ${filePath}`, (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout.includes('OK'));
          }
        });
      });

      return result as boolean;
    } catch (error) {
      console.error('Malware scan failed:', error);
      return false; // 검사 실패 시 업로드 거부
    }
  }
}
```

#### 3.2 파일 접근 제어
```typescript
// 서명된 URL을 통한 안전한 파일 접근
class SecureFileAccess {
  private static readonly SECRET = process.env.FILE_ACCESS_SECRET!;

  static generateSignedUrl(
    filePath: string,
    expiresIn: number = 3600, // 1시간
    permissions: string[] = ['read']
  ): string {
    const payload = {
      path: filePath,
      permissions,
      exp: Math.floor(Date.now() / 1000) + expiresIn
    };

    const signature = createHash('sha256')
      .update(JSON.stringify(payload) + this.SECRET)
      .digest('hex');

    const token = Buffer.from(JSON.stringify({ ...payload, signature }))
      .toString('base64url');

    return `/api/files/secure/${token}`;
  }

  static verifySignedUrl(token: string): { path: string; permissions: string[] } | null {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64url').toString());

      // 만료 시간 확인
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      // 서명 확인
      const { signature, ...data } = payload;
      const expectedSignature = createHash('sha256')
        .update(JSON.stringify(data) + this.SECRET)
        .digest('hex');

      if (signature !== expectedSignature) {
        return null;
      }

      return { path: payload.path, permissions: payload.permissions };
    } catch (error) {
      return null;
    }
  }
}

// 파일 서빙 미들웨어
app.get('/api/files/secure/:token', async (req, res) => {
  const verification = SecureFileAccess.verifySignedUrl(req.params.token);

  if (!verification) {
    return res.status(403).json({ error: 'Invalid or expired file access token' });
  }

  if (!verification.permissions.includes('read')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // 파일 스트리밍
  const filePath = path.join(process.env.UPLOAD_DIR!, verification.path);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});
```

### 4. API 보안

#### 4.1 Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// 일반 API 요청 제한
const generalLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:general:'
  }),
  windowMs: 15 * 60 * 1000, // 15분
  max: 1000, // 요청 제한
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 파일 업로드 제한 (더 엄격)
const uploadLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:upload:'
  }),
  windowMs: 60 * 60 * 1000, // 1시간
  max: 10, // 파일 업로드 제한
  message: {
    error: {
      code: 'UPLOAD_LIMIT_EXCEEDED',
      message: '파일 업로드 한도를 초과했습니다.'
    }
  }
});

// 사용자별 동적 제한
function createUserBasedLimiter(getUserId: (req: Request) => string) {
  return rateLimit({
    keyGenerator: (req) => `user:${getUserId(req)}`,
    windowMs: 15 * 60 * 1000,
    max: (req) => {
      const user = req.user;
      // 프리미엄 사용자는 더 높은 한도
      return user?.isPremium ? 2000 : 500;
    }
  });
}
```

#### 4.2 CORS 및 보안 헤더
```typescript
import helmet from 'helmet';
import cors from 'cors';

// 보안 헤더 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://trusted-scripts.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://cdn.videoprompt.com"],
      mediaSrc: ["'self'", "https://cdn.videoprompt.com"],
      connectSrc: ["'self'", "wss://api.videoprompt.com"],
      fontSrc: ["'self'", "https://fonts.googleapis.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS 설정
const corsOptions = {
  origin: (origin: string, callback: Function) => {
    const allowedOrigins = [
      'https://videoprompt.com',
      'https://www.videoprompt.com',
      'https://app.videoprompt.com'
    ];

    // 개발 환경에서는 localhost 허용
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS 정책에 의해 차단되었습니다'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### 5. 모니터링 및 로깅

#### 5.1 보안 로깅
```typescript
import winston from 'winston';

// 보안 이벤트 로거
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/security.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// 보안 이벤트 추적
class SecurityAudit {
  static logAuthAttempt(userId: string, success: boolean, ip: string) {
    securityLogger.info('Authentication attempt', {
      event: 'auth_attempt',
      userId,
      success,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  static logPermissionDenied(userId: string, resource: string, action: string) {
    securityLogger.warn('Permission denied', {
      event: 'permission_denied',
      userId,
      resource,
      action,
      timestamp: new Date().toISOString()
    });
  }

  static logSuspiciousActivity(details: any) {
    securityLogger.error('Suspicious activity detected', {
      event: 'suspicious_activity',
      details,
      timestamp: new Date().toISOString()
    });
  }

  static logDataAccess(userId: string, resource: string, action: string) {
    securityLogger.info('Data access', {
      event: 'data_access',
      userId,
      resource,
      action,
      timestamp: new Date().toISOString()
    });
  }
}

// 실시간 위협 탐지
class ThreatDetection {
  private static suspiciousPatterns = new Map<string, number>();

  static checkForThreats(req: Request): boolean {
    const ip = req.ip;
    const userAgent = req.get('User-Agent') || '';

    // 의심스러운 패턴 확인
    if (this.isScriptInjection(req.body)) {
      SecurityAudit.logSuspiciousActivity({
        type: 'script_injection',
        ip,
        userAgent,
        body: req.body
      });
      return true;
    }

    if (this.isRapidRequests(ip)) {
      SecurityAudit.logSuspiciousActivity({
        type: 'rapid_requests',
        ip,
        userAgent
      });
      return true;
    }

    return false;
  }

  private static isScriptInjection(body: any): boolean {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i
    ];

    const bodyStr = JSON.stringify(body);
    return dangerousPatterns.some(pattern => pattern.test(bodyStr));
  }

  private static isRapidRequests(ip: string): boolean {
    const now = Date.now();
    const key = `rapid_${ip}`;
    const count = this.suspiciousPatterns.get(key) || 0;

    if (count > 100) { // 1분에 100회 이상
      return true;
    }

    this.suspiciousPatterns.set(key, count + 1);

    // 1분 후 카운터 리셋
    setTimeout(() => {
      this.suspiciousPatterns.delete(key);
    }, 60000);

    return false;
  }
}
```

이러한 성능 최적화 및 보안 전략을 통해 Phase 3.9 영상 피드백 시스템의 안정성, 확장성, 보안성을 보장할 수 있습니다.