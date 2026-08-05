const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, cleanupUser } = require('./helpers');

const createdUserIds = [];
const FAKE_PHOTO = 'https://res.cloudinary.com/pgfvfcsl/image/upload/v1700000000/survo/users/fake/handover/test.jpg';

test('deal agreement gates the handover documentation service until both sides confirm', async () => {
  const owner = await createApprovedUser();
  const renter = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(owner.id, renter.id, stranger.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Deal Test Device', category: 'accessories', listingType: 'rent', pricePerDay: 20 });
  const equipmentId = createRes.body.item.id;

  // مفيش اتفاق لسه — التوثيق لازم يترفض
  const blockedRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ type: 'checkout', photos: [FAKE_PHOTO] });
  assert.equal(blockedRes.status, 403);

  // المستأجر (مش المالك) بيقترح اتفاق إيجار — مش محتاج يحدد otherPartyId
  const proposeRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ dealType: 'rent' });
  assert.equal(proposeRes.status, 201);
  assert.equal(proposeRes.body.item.status, 'pending');
  assert.equal(proposeRes.body.item.ownerConfirmed, false);
  assert.equal(proposeRes.body.item.otherPartyConfirmed, true);
  const dealId = proposeRes.body.item.id;

  // المالك لازم يحدد otherPartyId عشان يشوف حالة الاتفاق
  const ownerNoPartyRes = await request(app)
    .get('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(ownerNoPartyRes.status, 400);

  const ownerGetDealRes = await request(app)
    .get('/api/equipment/' + equipmentId + '/deal')
    .query({ otherPartyId: renter.id })
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(ownerGetDealRes.body.item.id, dealId);
  assert.equal(ownerGetDealRes.body.item.status, 'pending');

  // غريب مش طرف في الاتفاق ميقدرش يأكد
  const strangerConfirmRes = await request(app)
    .post('/api/equipment/deals/' + dealId + '/confirm')
    .set('Authorization', 'Bearer ' + stranger.token);
  assert.equal(strangerConfirmRes.status, 403);

  // لسه الاتفاق مش متأكد بالكامل — التوثيق لازم يترفض برضه
  const stillBlockedRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ type: 'checkout', photos: [FAKE_PHOTO] });
  assert.equal(stillBlockedRes.status, 403);

  // المالك بيأكد — دلوقتي الاتنين مؤكدين
  const confirmRes = await request(app)
    .post('/api/equipment/deals/' + dealId + '/confirm')
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(confirmRes.body.item.status, 'confirmed');

  // دلوقتي التوثيق المفروض يشتغل
  const unlockedRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ type: 'checkout', photos: [FAKE_PHOTO] });
  assert.equal(unlockedRes.status, 201);

  // إلغاء الاتفاق بعد التأكيد لازم يوقف التوثيق تاني
  const cancelRes = await request(app)
    .post('/api/equipment/deals/' + dealId + '/cancel')
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(cancelRes.body.item.status, 'cancelled');

  const blockedAfterCancelRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ type: 'checkin', photos: [FAKE_PHOTO] });
  assert.equal(blockedAfterCancelRes.status, 403);

  // إعادة اقتراح اتفاق بعد الإلغاء لازم تنجح (بدون تعارض unique constraint)
  const reProposeRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ dealType: 'sale' });
  assert.equal(reProposeRes.status, 201);
  assert.equal(reProposeRes.body.item.status, 'pending');
  assert.equal(reProposeRes.body.item.dealType, 'sale');
});

test('a deal proposed on a still-pending (unapproved) device listing stays reachable for its counterparty', async () => {
  const owner = await createApprovedUser();
  const buyer = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(owner.id, buyer.id, stranger.id);

  // فئة غير الاكسسوارات — بتفضل قيد المراجعة لحد ما الأدمن يوافق عليها
  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Pending Device', category: 'totalstation', listingType: 'sale', salePrice: 5000 });
  const equipmentId = createRes.body.item.id;
  assert.equal(createRes.body.item.moderationStatus, 'pending');

  // قبل أي اتفاق، أي حد تاني (حتى المشتري المستهدف) لازم ياخد 404 عادي
  const beforeDealRes = await request(app)
    .get('/api/equipment/' + equipmentId)
    .set('Authorization', 'Bearer ' + buyer.token);
  assert.equal(beforeDealRes.status, 404);

  await request(app)
    .post('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ dealType: 'sale', otherPartyId: buyer.id });

  // المالك يقدر يشوف الجهاز برضه وهو لسه قيد المراجعة
  const ownerRes = await request(app)
    .get('/api/equipment/' + equipmentId)
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(ownerRes.status, 200);

  // بعد ما اتقترح عليه اتفاق، المشتري يقدر يفتح رابط الإشعار ويشوف تفاصيل الجهاز
  const buyerRes = await request(app)
    .get('/api/equipment/' + equipmentId)
    .set('Authorization', 'Bearer ' + buyer.token);
  assert.equal(buyerRes.status, 200);
  assert.equal(buyerRes.body.item.id, equipmentId);

  // غريب مش طرف في أي اتفاق لسه ياخد 404
  const strangerRes = await request(app)
    .get('/api/equipment/' + equipmentId)
    .set('Authorization', 'Bearer ' + stranger.token);
  assert.equal(strangerRes.status, 404);
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
