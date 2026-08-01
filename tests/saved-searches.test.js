const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, cleanupUser, uniqueSuffix } = require('./helpers');

const createdUserIds = [];

test('saved searches: CRUD, cap enforcement, and match notifications on equipment approval', async () => {
  const seeker = await createApprovedUser();
  const owner = await createApprovedUser();
  createdUserIds.push(seeker.id, owner.id);

  const govSuffix = uniqueSuffix();
  const createRes = await request(app)
    .post('/api/saved-searches')
    .set('Authorization', 'Bearer ' + seeker.token)
    .send({ governorate: govSuffix, keyword: 'Trimble' });
  assert.equal(createRes.status, 201);
  const savedSearchId = createRes.body.item.id;

  const listRes = await request(app)
    .get('/api/saved-searches')
    .set('Authorization', 'Bearer ' + seeker.token);
  assert.equal(listRes.body.items.length, 1);

  const emptyRes = await request(app)
    .post('/api/saved-searches')
    .set('Authorization', 'Bearer ' + seeker.token)
    .send({});
  assert.equal(emptyRes.status, 400);

  // إعلان فئة gps مش accessories، فهيبقى pending ومش المفروض يبعت إشعار وقت الإنشاء
  const matchingEquipRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Trimble R8 GNSS', category: 'gps', listingType: 'sale', salePrice: 50000, governorate: govSuffix });
  assert.equal(matchingEquipRes.body.pendingReview, true);

  const accessoryMatchRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Trimble tripod', category: 'accessories', listingType: 'sale', salePrice: 500, governorate: govSuffix });
  assert.equal(accessoryMatchRes.status, 201);
  assert.equal(accessoryMatchRes.body.item.moderationStatus, 'approved');
  const matchedEquipmentId = accessoryMatchRes.body.item.id;

  const nonMatchRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Leica level', category: 'accessories', listingType: 'sale', salePrice: 500, governorate: govSuffix });
  assert.equal(nonMatchRes.status, 201);

  const notifs = await prisma.notification.findMany({ where: { userId: seeker.id, targetType: 'equipment' } });
  assert.equal(notifs.length, 1, 'only the keyword-matching accessory listing should have notified the seeker');
  assert.equal(notifs[0].targetId, matchedEquipmentId);

  const deleteRes = await request(app)
    .delete('/api/saved-searches/' + savedSearchId)
    .set('Authorization', 'Bearer ' + seeker.token);
  assert.equal(deleteRes.status, 200);

  const listAfterDeleteRes = await request(app)
    .get('/api/saved-searches')
    .set('Authorization', 'Bearer ' + seeker.token);
  assert.equal(listAfterDeleteRes.body.items.length, 0);

  const otherSeeker = await createApprovedUser();
  createdUserIds.push(otherSeeker.id);
  for (let i = 0; i < 10; i++) {
    await request(app)
      .post('/api/saved-searches')
      .set('Authorization', 'Bearer ' + otherSeeker.token)
      .send({ governorate: 'Cairo' });
  }
  const overCapRes = await request(app)
    .post('/api/saved-searches')
    .set('Authorization', 'Bearer ' + otherSeeker.token)
    .send({ governorate: 'Cairo' });
  assert.equal(overCapRes.status, 400);
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.savedSearch.deleteMany({ where: { userId: id } });
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
