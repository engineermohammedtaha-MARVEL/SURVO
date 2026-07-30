const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser } = require('./helpers');

const createdUserIds = [];
const adminSecret = process.env.ADMIN_SECRET;

test('non-accessory equipment starts pending and is hidden until admin approves it', async () => {
  const owner = await createApprovedUser();
  createdUserIds.push(owner.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Smoke Test Total Station', category: 'totalstation', listingType: 'rent', pricePerDay: 100 });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.item.moderationStatus, 'pending');
  const equipmentId = createRes.body.item.id;

  const publicListRes = await request(app).get('/api/equipment');
  const foundBeforeApproval = publicListRes.body.items.some((i) => i.id === equipmentId);
  assert.equal(foundBeforeApproval, false, 'pending equipment should not appear in the public feed');

  const wrongSecretRes = await request(app)
    .post('/api/admin/equipment/' + equipmentId + '/approve')
    .set('x-admin-secret', 'not-the-real-secret');
  assert.equal(wrongSecretRes.status, 401);

  const approveRes = await request(app)
    .post('/api/admin/equipment/' + equipmentId + '/approve')
    .set('x-admin-secret', adminSecret);
  assert.equal(approveRes.status, 200);

  const publicListAfterRes = await request(app).get('/api/equipment');
  const foundAfterApproval = publicListAfterRes.body.items.some((i) => i.id === equipmentId);
  assert.equal(foundAfterApproval, true, 'approved equipment should appear in the public feed');
});

test('editing an approved equipment listing sends it back to pending review', async () => {
  const owner = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(owner.id, stranger.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ title: 'Edit Test GPS', category: 'gps', listingType: 'rent', pricePerDay: 150 });
  const equipmentId = createRes.body.item.id;

  await request(app).post('/api/admin/equipment/' + equipmentId + '/approve').set('x-admin-secret', adminSecret);

  const visibleBeforeEdit = await request(app).get('/api/equipment');
  assert.equal(visibleBeforeEdit.body.items.some((i) => i.id === equipmentId), true);

  const strangerEditRes = await request(app)
    .patch('/api/equipment/' + equipmentId)
    .set('Authorization', 'Bearer ' + stranger.token)
    .send({ pricePerDay: 999 });
  assert.equal(strangerEditRes.status, 403);

  const ownerEditRes = await request(app)
    .patch('/api/equipment/' + equipmentId)
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ pricePerDay: 200 });
  assert.equal(ownerEditRes.status, 200);
  assert.equal(ownerEditRes.body.item.moderationStatus, 'pending');
  assert.equal(ownerEditRes.body.pendingReview, true);

  const hiddenAfterEdit = await request(app).get('/api/equipment');
  assert.equal(hiddenAfterEdit.body.items.some((i) => i.id === equipmentId), false, 'edited listing should be hidden again until re-approved');

  const pendingListRes = await request(app).get('/api/admin/equipment/pending').set('x-admin-secret', adminSecret);
  assert.equal(pendingListRes.body.items.some((i) => i.id === equipmentId), true, 'edited listing should reappear in the admin review queue');
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.equipment.deleteMany({ where: { ownerId: id } });
    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});
