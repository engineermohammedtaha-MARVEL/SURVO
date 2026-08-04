const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, cleanupUser } = require('./helpers');

const createdUserIds = [];

test('owner can delete their own rental request, other users cannot', async () => {
  const owner = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(owner.id, stranger.id);

  const createRes = await request(app)
    .post('/api/requests')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ category: 'gps', type: 'rent', details: 'smoke test request' });
  assert.equal(createRes.status, 201);
  const requestId = createRes.body.item.id;

  const strangerDeleteRes = await request(app)
    .delete('/api/requests/' + requestId)
    .set('Authorization', 'Bearer ' + stranger.token);
  assert.equal(strangerDeleteRes.status, 403);

  const stillThereRes = await request(app).get('/api/requests/' + requestId);
  assert.equal(stillThereRes.status, 200);

  const ownerDeleteRes = await request(app)
    .delete('/api/requests/' + requestId)
    .set('Authorization', 'Bearer ' + owner.token);
  assert.equal(ownerDeleteRes.status, 200);
  assert.equal(ownerDeleteRes.body.success, true);

  const goneRes = await request(app).get('/api/requests/' + requestId);
  assert.equal(goneRes.status, 404);
});

test('deleting a rental request requires authentication', async () => {
  const owner = await createApprovedUser();
  createdUserIds.push(owner.id);

  const createRes = await request(app)
    .post('/api/requests')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ category: 'level', type: 'buy', details: 'smoke test request 2' });
  const requestId = createRes.body.item.id;

  const res = await request(app).delete('/api/requests/' + requestId);
  assert.equal(res.status, 401);

  await request(app).delete('/api/requests/' + requestId).set('Authorization', 'Bearer ' + owner.token);
});

test('owner can edit their own rental request, other users cannot', async () => {
  const owner = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(owner.id, stranger.id);

  const createRes = await request(app)
    .post('/api/requests')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ category: 'gps', type: 'rent', details: 'original details', governorate: 'Cairo' });
  const requestId = createRes.body.item.id;

  const strangerEditRes = await request(app)
    .patch('/api/requests/' + requestId)
    .set('Authorization', 'Bearer ' + stranger.token)
    .send({ details: 'hijacked details' });
  assert.equal(strangerEditRes.status, 403);

  const ownerEditRes = await request(app)
    .patch('/api/requests/' + requestId)
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ category: 'totalstation', details: 'updated details', governorate: 'Giza' });
  assert.equal(ownerEditRes.status, 200);
  assert.equal(ownerEditRes.body.item.category, 'totalstation');
  assert.equal(ownerEditRes.body.item.details, 'updated details');
  assert.equal(ownerEditRes.body.item.governorate, 'Giza');

  const fetchRes = await request(app).get('/api/requests/' + requestId);
  assert.equal(fetchRes.body.item.details, 'updated details');
});

test('request brand is stored for device categories and cleared for accessories', async () => {
  const owner = await createApprovedUser();
  createdUserIds.push(owner.id);

  const createRes = await request(app)
    .post('/api/requests')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ category: 'gps', type: 'rent', brand: 'Leica', details: 'brand test' });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.item.brand, 'Leica');
  const requestId = createRes.body.item.id;

  const editToAccessoriesRes = await request(app)
    .patch('/api/requests/' + requestId)
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ category: 'accessories', brand: 'Sokkia' });
  assert.equal(editToAccessoriesRes.status, 200);
  assert.equal(editToAccessoriesRes.body.item.brand, null, 'brand should be cleared once the request is for accessories');

  await request(app).delete('/api/requests/' + requestId).set('Authorization', 'Bearer ' + owner.token);
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
