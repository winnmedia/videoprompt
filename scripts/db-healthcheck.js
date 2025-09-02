/* Simple DB read/write healthcheck for Prisma (Railway Postgres) */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await prisma.$connect();

    const st = await prisma.shareToken.create({
      data: {
        token,
        role: 'commenter',
        nickname: 'health',
        targetType: 'video',
        targetId: 'healthcheck-video',
        expiresAt,
      },
      select: { token: true },
    });

    const found = await prisma.shareToken.findUnique({ where: { token: st.token } });

    const created = await prisma.comment.create({
      data: {
        targetType: 'video',
        targetId: 'healthcheck-video',
        author: 'health',
        text: 'ok',
        timecode: '000000',
      },
      select: { id: true },
    });

    const comments = await prisma.comment.findMany({
      where: { targetType: 'video', targetId: 'healthcheck-video' },
      take: 1,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    console.log(
      JSON.stringify(
        { ok: true, token: found?.token, commentId: created.id, comments: comments.length },
        null,
        2,
      ),
    );

    await prisma.comment.deleteMany({ where: { targetType: 'video', targetId: 'healthcheck-video' } });
    await prisma.shareToken.delete({ where: { token: st.token } });
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();


