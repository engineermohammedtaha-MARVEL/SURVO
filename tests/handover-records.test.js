const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, cleanupUser } = require('./helpers');

const createdUserIds = [];
const FAKE_PHOTO = 'https://res.cloudinary.com/pgfvfcsl/image/upload/v1700000000/survo/users/fake/handover/test.jpg';

test('handover records: create/list scoped to owner+renter, signed-photos scoped to participants only', async () => {
  const owner = await createApprovedUser();
  const renter = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(owner.id, renter.id, stranger.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Handover Test Device', category: 'accessories', listingType: 'rent', pricePerDay: 30 });
  const equipmentId = createRes.body.item.id;

  // الطرف التاني (المستأجر) بيوثق استلام الجهاز — مش محتاج يحدد otherPartyId، السيرفر بيحدده تلقائي (المالك)
  const checkoutRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({
      type: 'checkout',
      photos: [FAKE_PHOTO],
      notes: 'الجهاز سليم',
      checklist: ['working', 'battery', 'not_a_real_key'],
      certificateUrl: FAKE_PHOTO,
    });
  assert.equal(checkoutRes.status, 201);
  assert.equal(checkoutRes.body.item.ownerId, owner.id);
  assert.equal(checkoutRes.body.item.otherPartyId, renter.id);
  assert.deepEqual(checkoutRes.body.item.checklist, ['working', 'battery'], 'unknown checklist keys must be filtered out');
  assert.equal(checkoutRes.body.item.certificateUrl, FAKE_PHOTO);

  // المالك لازم يحدد otherPartyId عشان يشوف/يضيف سجلات
  const ownerNoPartyRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ type: 'checkin', photos: [FAKE_PHOTO] });
  assert.equal(ownerNoPartyRes.status, 400);

  const ownerCheckinRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ type: 'checkin', photos: [FAKE_PHOTO], otherPartyId: renter.id });
  assert.equal(ownerCheckinRes.status, 201);

  // المستأجر بيشوف السجلات من غير ما يحدد otherPartyId (السيرفر بيحدده هو نفسه تلقائي)
  const renterListRes = await request(app)
    .get('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + renter.token);
  assert.equal(renterListRes.body.items.length, 2);

  // المالك بيشوف نفس السجلات لما يحدد otherPartyId=renter.id
  const ownerListRes = await request(app)
    .get('/api/equipment/' + equipmentId + '/handovers')
    .query({ otherPartyId: renter.id })
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(ownerListRes.body.items.length, 2);

  const handoverId = checkoutRes.body.item.id;

  const strangerSignedRes = await request(app)
    .get('/api/equipment/handovers/' + handoverId + '/signed-photos')
    .set('Authorization', 'Bearer ' + stranger.token);
  assert.equal(strangerSignedRes.status, 403);

  const ownerSignedRes = await request(app)
    .get('/api/equipment/handovers/' + handoverId + '/signed-photos')
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(ownerSignedRes.status, 200);
  assert.equal(ownerSignedRes.body.urls.length, 1);
  assert.ok(ownerSignedRes.body.certificateUrl, 'certificate url should also be signed and returned');

  const renterSignedRes = await request(app)
    .get('/api/equipment/handovers/' + handoverId + '/signed-photos')
    .set('Authorization', 'Bearer ' + renter.token);
  assert.equal(renterSignedRes.status, 200);

  // لازم إشعار وصل للمالك بعد ما المستأجر وثّق التسليم
  const ownerNotifs = await prisma.notification.findMany({ where: { userId: owner.id, targetType: 'equipment', targetId: equipmentId } });
  assert.ok(ownerNotifs.length >= 1);
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
