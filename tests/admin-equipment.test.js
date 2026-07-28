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

after(async () => {
  for (const id of createdUserIds) {
    await prisma.equipment.deleteMany({ where: { ownerId: id } });
    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});
