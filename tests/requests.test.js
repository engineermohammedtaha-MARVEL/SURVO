const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser } = require('./helpers');

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

after(async () => {
  for (const id of createdUserIds) {
    await prisma.rentalRequest.deleteMany({ where: { requesterId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});
