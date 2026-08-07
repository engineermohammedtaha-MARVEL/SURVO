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

test('deal notifications point at targetType "deal" so either party can jump straight to the handover screen', async () => {
  const owner = await createApprovedUser();
  const renter = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(owner.id, renter.id, stranger.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Notification Target Test Device', category: 'accessories', listingType: 'rent', pricePerDay: 15 });
  const equipmentId = createRes.body.item.id;

  // الطرف التاني (المستأجر) بيقترح الاتفاق — الإشعار المفروض يوصل للمالك
  const proposeRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ dealType: 'rent' });
  const dealId = proposeRes.body.item.id;

  const notif = await prisma.notification.findFirst({ where: { userId: owner.id, title: { contains: 'اقتراح اتفاق' } } });
  assert.ok(notif, 'owner should be notified of the new proposal');
  assert.equal(notif.targetType, 'deal');
  assert.equal(notif.targetId, dealId);

  // المالك (اللي وصله الإشعار) يقدر يفتح الاتفاق مباشرة بالـ id بتاعه
  const ownerGetRes = await request(app)
    .get('/api/equipment/deals/' + dealId)
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(ownerGetRes.status, 200);
  assert.equal(ownerGetRes.body.item.id, dealId);
  assert.equal(ownerGetRes.body.item.equipmentId, equipmentId);

  // الطرف التاني (اللي اقترح) يقدر يفتحه بنفس الطريقة
  const renterGetRes = await request(app)
    .get('/api/equipment/deals/' + dealId)
    .set('Authorization', 'Bearer ' + renter.token);
  assert.equal(renterGetRes.status, 200);

  // غريب مش طرف في الاتفاق ياخد 403
  const strangerGetRes = await request(app)
    .get('/api/equipment/deals/' + dealId)
    .set('Authorization', 'Bearer ' + stranger.token);
  assert.equal(strangerGetRes.status, 403);

  // بعد ما المالك يأكد، الإشعار اللي بيوصل للمستأجر لازم يبقى نفس النوع كمان
  await request(app)
    .post('/api/equipment/deals/' + dealId + '/confirm')
    .set('Authorization', 'Bearer ' + owner.token);
  const confirmedNotif = await prisma.notification.findFirst({ where: { userId: renter.id, title: { contains: 'تأكيد الاتفاق' } } });
  assert.ok(confirmedNotif);
  assert.equal(confirmedNotif.targetType, 'deal');
  assert.equal(confirmedNotif.targetId, dealId);
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

test('deal proposal notification names the proposer, not just the equipment', async () => {
  const owner = await createApprovedUser();
  const renter = await createApprovedUser();
  createdUserIds.push(owner.id, renter.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Proposer Name Test Device', category: 'accessories', listingType: 'rent', pricePerDay: 25 });
  const equipmentId = createRes.body.item.id;

  await request(app)
    .post('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ dealType: 'rent' });

  const notif = await prisma.notification.findFirst({ where: { userId: owner.id, title: { contains: 'اقتراح اتفاق' } } });
  assert.ok(notif, 'owner should be notified of the new proposal');
  assert.ok(notif.body.includes(renter.fullName), 'notification should name who sent the proposal');
  assert.ok(notif.body.includes('Proposer Name Test Device'), 'notification should still name the listing');
});

test('two users who already have a deal on one listing get a fully separate deal when they agree on a different listing', async () => {
  const owner = await createApprovedUser();
  const otherParty = await createApprovedUser();
  createdUserIds.push(owner.id, otherParty.id);

  const createA = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Listing A - Isolation Test', category: 'accessories', listingType: 'rent', pricePerDay: 30 });
  const equipmentA = createA.body.item.id;

  const proposeA = await request(app)
    .post('/api/equipment/' + equipmentA + '/deal')
    .set('Authorization', 'Bearer ' + otherParty.token)
    .send({ dealType: 'rent' });
  await request(app)
    .post('/api/equipment/deals/' + proposeA.body.item.id + '/confirm')
    .set('Authorization', 'Bearer ' + owner.token);

  const dealAStatus = await request(app)
    .get('/api/equipment/' + equipmentA + '/deal')
    .set('Authorization', 'Bearer ' + otherParty.token);
  assert.equal(dealAStatus.body.item.status, 'confirmed');

  // نفس الطرفين بالظبط، بس اعلان مختلف تمامًا — المفروض يبدأ من الصفر، مفيش اتفاق أصلاً
  const createB = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Listing B - Isolation Test', category: 'accessories', listingType: 'sale', salePrice: 700 });
  const equipmentB = createB.body.item.id;

  const dealBBefore = await request(app)
    .get('/api/equipment/' + equipmentB + '/deal')
    .set('Authorization', 'Bearer ' + otherParty.token);
  assert.equal(dealBBefore.body.item, null, 'no deal should pre-exist on the new listing just because these 2 users agreed on a different one');

  const proposeB = await request(app)
    .post('/api/equipment/' + equipmentB + '/deal')
    .set('Authorization', 'Bearer ' + otherParty.token)
    .send({ dealType: 'sale' });
  assert.equal(proposeB.body.item.status, 'pending', 'listing B must start pending, not inherit confirmed status from listing A');

  const dealAStillConfirmed = await request(app)
    .get('/api/equipment/' + equipmentA + '/deal')
    .set('Authorization', 'Bearer ' + otherParty.token);
  assert.equal(dealAStillConfirmed.body.item.status, 'confirmed', 'listing A deal must be unaffected by the new proposal on listing B');
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
