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
    .send({ title: 'Handover Test Device', category: 'totalstation', listingType: 'rent', pricePerDay: 30 });
  const equipmentId = createRes.body.item.id;

  // خدمة التوثيق متفعّلتش إلا بعد ما الطرفين يتفقوا ويأكدوا نوع الصفقة (اتفاق إيجار هنا)
  const proposeRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ dealType: 'rent' });
  await request(app)
    .post('/api/equipment/deals/' + proposeRes.body.item.id + '/confirm')
    .set('Authorization', 'Bearer ' + owner.token);

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

  // لازم إشعار وصل للمالك بعد ما المستأجر وثّق التسليم — وبما إن المستأجر هو اللي استلم
  // الجهاز (checkout)، فده "تسليم" بالنسبة للمالك (هو اللي بيدّي الجهاز)
  const ownerNotifs = await prisma.notification.findMany({ where: { userId: owner.id, targetType: 'equipment', targetId: equipmentId } });
  assert.ok(ownerNotifs.length >= 1);
  assert.ok(ownerNotifs.some((n) => n.title === 'تم توثيق تسليم الجهاز'), 'owner should be told this was a delivery, from their side');

  // وبعد ما المالك وثّق استرجاع الجهاز (checkin)، المستأجر لازم ياخد إشعار "تسليم" برضه —
  // بما إنه هو اللي رجّع الجهاز، مش "استلام"
  const renterNotifs = await prisma.notification.findMany({ where: { userId: renter.id, targetType: 'equipment', targetId: equipmentId } });
  assert.ok(renterNotifs.some((n) => n.title === 'تم توثيق تسليم الجهاز'), 'renter should be told this was a delivery (of the return), from their side');
});

test('handover records: sale deals only allow a single checkout, no checkin', async () => {
  const owner = await createApprovedUser();
  const buyer = await createApprovedUser();
  createdUserIds.push(owner.id, buyer.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Sale Handover Test Device', category: 'totalstation', listingType: 'sale', salePrice: 500 });
  const equipmentId = createRes.body.item.id;

  const proposeRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + buyer.token)
    .send({ dealType: 'sale' });
  await request(app)
    .post('/api/equipment/deals/' + proposeRes.body.item.id + '/confirm')
    .set('Authorization', 'Bearer ' + owner.token);

  const checkinAttemptRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + buyer.token)
    .send({ type: 'checkin', photos: [FAKE_PHOTO] });
  assert.equal(checkinAttemptRes.status, 400, 'sale deals must not allow a checkin (return) documentation');

  const firstCheckoutRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + buyer.token)
    .send({ type: 'checkout', photos: [FAKE_PHOTO] });
  assert.equal(firstCheckoutRes.status, 201);

  const secondCheckoutRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + buyer.token)
    .send({ type: 'checkout', photos: [FAKE_PHOTO] });
  assert.equal(secondCheckoutRes.status, 400, 'sale deals only document the handover once');
});

test('my-equipment list flags a device as pending return while it is checked out to a renter', async () => {
  const owner = await createApprovedUser();
  const renter = await createApprovedUser();
  createdUserIds.push(owner.id, renter.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Pending Return Test Device', category: 'totalstation', listingType: 'rent', pricePerDay: 40 });
  const equipmentId = createRes.body.item.id;

  const proposeRes = await request(app)
    .post('/api/equipment/' + equipmentId + '/deal')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ dealType: 'rent' });
  await request(app)
    .post('/api/equipment/deals/' + proposeRes.body.item.id + '/confirm')
    .set('Authorization', 'Bearer ' + owner.token);

  // قبل أي تسليم، مفروض مفيش استرجاع معلّق
  const beforeRes = await request(app).get('/api/equipment/mine').set('Authorization', 'Bearer ' + owner.token);
  const beforeItem = beforeRes.body.items.find((i) => i.id === equipmentId);
  assert.deepEqual(beforeItem.pendingReturns, []);

  // بعد التسليم (checkout)، الجهاز لازم يظهر كاسترجاع معلّق للمالك
  await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + renter.token)
    .send({ type: 'checkout', photos: [FAKE_PHOTO] });

  const afterCheckoutRes = await request(app).get('/api/equipment/mine').set('Authorization', 'Bearer ' + owner.token);
  const afterCheckoutItem = afterCheckoutRes.body.items.find((i) => i.id === equipmentId);
  assert.equal(afterCheckoutItem.pendingReturns.length, 1);
  assert.equal(afterCheckoutItem.pendingReturns[0].otherPartyId, renter.id);

  // بعد ما المالك يوثّق الاستلام (checkin)، الاسترجاع المعلّق لازم يختفي
  await request(app)
    .post('/api/equipment/' + equipmentId + '/handovers')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ type: 'checkin', photos: [FAKE_PHOTO], otherPartyId: renter.id });

  const afterCheckinRes = await request(app).get('/api/equipment/mine').set('Authorization', 'Bearer ' + owner.token);
  const afterCheckinItem = afterCheckinRes.body.items.find((i) => i.id === equipmentId);
  assert.deepEqual(afterCheckinItem.pendingReturns, []);
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
