const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, createAdminUser, cleanupUser } = require('./helpers');

const createdUserIds = [];

test('viewsCount increments for other viewers but not for the owner or admin, and is hidden from the public response', async () => {
  const owner = await createApprovedUser();
  const stranger = await createApprovedUser();
  const admin = await createAdminUser();
  createdUserIds.push(owner.id, stranger.id, admin.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'View Count Test', category: 'accessories', listingType: 'rent', pricePerDay: 20 });
  const equipmentId = createRes.body.item.id;

  // مالك الإعلان بيشوفه (مش المفروض يزود العداد)
  await request(app).post('/api/equipment/' + equipmentId + '/view').set('Authorization', 'Bearer ' + owner.token);
  // زائر من غير تسجيل دخول
  await request(app).post('/api/equipment/' + equipmentId + '/view');
  // مستخدم تاني مسجل دخول
  await request(app).post('/api/equipment/' + equipmentId + '/view').set('Authorization', 'Bearer ' + stranger.token);
  // الأدمن بيشوفه وقت المراجعة (مش المفروض يتحسب برضه)
  await request(app).post('/api/equipment/' + equipmentId + '/view').set('Authorization', 'Bearer ' + admin.token);

  const getOneRes = await request(app).get('/api/equipment/' + equipmentId);
  assert.equal(getOneRes.body.item.viewsCount, undefined, 'viewsCount should not leak in the public detail response');

  const mineRes = await request(app).get('/api/equipment/mine').set('Authorization', 'Bearer ' + owner.token);
  const mine = mineRes.body.items.find((i) => i.id === equipmentId);
  assert.equal(mine.viewsCount, 2, 'only the two non-owner, non-admin views should have counted');
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
