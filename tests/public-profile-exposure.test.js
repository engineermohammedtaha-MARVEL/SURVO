const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, createAdminUser } = require('./helpers');

const createdUserIds = [];

test('public profile endpoint never leaks internal/sensitive fields', async () => {
  const owner = await createApprovedUser({ bio: 'test bio', governorate: 'Cairo' });
  createdUserIds.push(owner.id);

  await prisma.user.update({
    where: { id: owner.id },
    data: { nationalIdUrl: 'https://res.cloudinary.com/x/image/upload/v1/secret-id.jpg', email: 'secret@example.com' },
  });

  const res = await request(app).get('/api/users/' + owner.id);
  assert.equal(res.status, 200);
  const user = res.body.user;

  assert.equal(user.nationalIdUrl, undefined, 'nationalIdUrl must never be public');
  assert.equal(user.personalPhotoUrl, undefined);
  assert.equal(user.qualificationUrl, undefined);
  assert.equal(user.unionCardUrl, undefined);
  assert.equal(user.commercialRecordUrl, undefined);
  assert.equal(user.email, undefined, 'email must not be public');
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.resetTokenHash, undefined);
  assert.equal(user.resetTokenExpiresAt, undefined);
  assert.equal(user.tokenVersion, undefined);
  assert.equal(user.isAdmin, undefined, 'isAdmin must never be public — reveals admin account identity');
  assert.equal(user.accountStatus, undefined);

  // fields the profile page actually needs must still be present
  assert.equal(user.id, owner.id);
  assert.equal(user.bio, 'test bio');
  assert.equal(user.governorate, 'Cairo');
  assert.equal(typeof user.rating, 'number');
});

test('equipment list/detail never leak ownershipDocUrl/serialNumberPhotoUrl', async () => {
  const owner = await createApprovedUser();
  const admin = await createAdminUser();
  createdUserIds.push(owner.id, admin.id);

  const createRes = await request(app)
    .post('/api/equipment')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({
      title: 'Exposure Test Accessory',
      category: 'accessories',
      listingType: 'rent',
      pricePerDay: 10,
      ownershipDocUrl: 'https://res.cloudinary.com/x/image/upload/v1/secret-doc.jpg',
      serialNumberPhotoUrl: 'https://res.cloudinary.com/x/image/upload/v1/secret-serial.jpg',
    });
  assert.equal(createRes.status, 201);
  const equipmentId = createRes.body.item.id;

  const listRes = await request(app).get('/api/equipment');
  const found = listRes.body.items.find((i) => i.id === equipmentId);
  assert.ok(found, 'listing should be visible (accessories auto-approve)');
  assert.equal(found.ownershipDocUrl, undefined);
  assert.equal(found.serialNumberPhotoUrl, undefined);

  const getOneRes = await request(app).get('/api/equipment/' + equipmentId);
  assert.equal(getOneRes.status, 200);
  assert.equal(getOneRes.body.item.ownershipDocUrl, undefined);
  assert.equal(getOneRes.body.item.serialNumberPhotoUrl, undefined);

  // owner's own "my equipment" list still needs these fields to support editing
  const mineRes = await request(app).get('/api/equipment/mine').set('Authorization', 'Bearer ' + owner.token);
  const mine = mineRes.body.items.find((i) => i.id === equipmentId);
  assert.equal(mine.ownershipDocUrl, 'https://res.cloudinary.com/x/image/upload/v1/secret-doc.jpg');
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.equipment.deleteMany({ where: { ownerId: id } });
    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});
