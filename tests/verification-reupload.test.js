const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, createAdminUser, cleanupUser } = require('./helpers');

const createdUserIds = [];
const FAKE_DOC = 'https://res.cloudinary.com/pgfvfcsl/image/upload/v1700000000/survo/users/fake/verification/test.jpg';

test('re-uploading a verification doc marks the account pending review, and admin can approve or reject it', async () => {
  const user = await createApprovedUser();
  const admin = await createAdminUser();
  createdUserIds.push(user.id, admin.id);

  // الحساب لسه ما وثّقش نفسه، مفروض ما يظهرش في قائمة إعادة التوثيق
  const beforeRes = await request(app)
    .get('/api/admin/verifications/pending')
    .set('Authorization', 'Bearer ' + admin.token);
  assert.equal(beforeRes.body.users.some((u) => u.id === user.id), false);

  // رفع كارنيه نقابة جديد عن طريق تعديل البيانات
  const updateRes = await request(app)
    .patch('/api/users/me')
    .set('Authorization', 'Bearer ' + user.token)
    .send({ unionCardUrl: FAKE_DOC });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.user.verification, 'pending');

  // دلوقتي المفروض يظهر في قائمة الأدمن لإعادة التوثيق
  const afterRes = await request(app)
    .get('/api/admin/verifications/pending')
    .set('Authorization', 'Bearer ' + admin.token);
  const entry = afterRes.body.users.find((u) => u.id === user.id);
  assert.ok(entry, 'user should appear in pending verifications');
  assert.equal(entry.unionCardUrl, FAKE_DOC);

  // مستخدم عادي (مش أدمن) ميقدرش يشوف القائمة دي
  const nonAdminRes = await request(app)
    .get('/api/admin/verifications/pending')
    .set('Authorization', 'Bearer ' + user.token);
  assert.equal(nonAdminRes.status, 403);

  // الأدمن يوثّق الحساب
  const approveRes = await request(app)
    .post('/api/admin/verifications/' + user.id + '/approve')
    .set('Authorization', 'Bearer ' + admin.token);
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.user.verification, 'verified');

  const notif = await prisma.notification.findFirst({ where: { userId: user.id, title: { contains: 'توثيق' } } });
  assert.ok(notif, 'user should be notified once verified');
});

test('rejecting a re-verification request resets the badge to unverified', async () => {
  const user = await createApprovedUser();
  const admin = await createAdminUser();
  createdUserIds.push(user.id, admin.id);

  await request(app)
    .patch('/api/users/me')
    .set('Authorization', 'Bearer ' + user.token)
    .send({ nationalIdUrl: FAKE_DOC });

  const rejectRes = await request(app)
    .post('/api/admin/verifications/' + user.id + '/reject')
    .set('Authorization', 'Bearer ' + admin.token)
    .send({ reason: 'الصورة مش واضحة' });
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.user.verification, 'unverified');
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
