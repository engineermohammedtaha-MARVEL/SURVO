const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request, app, prisma, createApprovedUser } = require('./helpers');

const createdUserIds = [];

test('changing password invalidates previously issued tokens', async () => {
  const user = await createApprovedUser();
  createdUserIds.push(user.id);

  // نفس المستخدم لسه شغال بيه قبل ما يغير كلمة السر
  const meBefore = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + user.token);
  assert.equal(meBefore.status, 200);

  // نحاكي رابط "نسيت كلمة السر" من غير ما نبعت إيميل فعلي
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const resetRes = await request(app).post('/api/auth/reset-password').send({ token: rawToken, password: 'NewPass1234' });
  assert.equal(resetRes.status, 200);

  // نفس التوكن القديم لازم يترفض دلوقتي حتى إنه لسه شكله سليم ومامتنهاش صلاحيته
  const meAfter = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + user.token);
  assert.equal(meAfter.status, 401);

  // لكن تسجيل دخول بكلمة السر الجديدة لازم يشتغل عادي
  const loginRes = await request(app).post('/api/auth/login').send({ phone: user.phone, password: 'NewPass1234' });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.success, true);
});

test('rejecting an account invalidates its existing token immediately', async () => {
  const user = await createApprovedUser();
  createdUserIds.push(user.id);

  const meBefore = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + user.token);
  assert.equal(meBefore.status, 200);

  await prisma.user.update({ where: { id: user.id }, data: { accountStatus: 'rejected' } });

  const meAfter = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + user.token);
  assert.equal(meAfter.status, 401);
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.user.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});
