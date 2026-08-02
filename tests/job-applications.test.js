const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, cleanupUser } = require('./helpers');

const createdUserIds = [];

test('job applications: applying shows up under the applicant own "my applications" list', async () => {
  const poster = await createApprovedUser();
  const applicant = await createApprovedUser();
  createdUserIds.push(poster.id, applicant.id);

  const jobRes = await request(app)
    .post('/api/jobs')
    .set('Authorization', 'Bearer ' + poster.token)
    .send({ title: 'مهندس مساحة', jobType: 'engineer', workType: 'full', governorate: 'Cairo' });
  const jobId = jobRes.body.item.id;

  const emptyRes = await request(app)
    .get('/api/jobs/applications/mine')
    .set('Authorization', 'Bearer ' + applicant.token);
  assert.equal(emptyRes.body.items.length, 0);

  await request(app)
    .post('/api/jobs/' + jobId + '/contact')
    .set('Authorization', 'Bearer ' + applicant.token)
    .send({ message: 'مهتم بالوظيفة' });

  const afterRes = await request(app)
    .get('/api/jobs/applications/mine')
    .set('Authorization', 'Bearer ' + applicant.token);
  assert.equal(afterRes.body.items.length, 1);
  assert.equal(afterRes.body.items[0].job.id, jobId);
  assert.equal(afterRes.body.items[0].job.title, 'مهندس مساحة');
  assert.equal(afterRes.body.items[0].job.poster.id, poster.id);
  assert.equal(afterRes.body.items[0].message, 'مهتم بالوظيفة');

  // مطبّق التقديم لا يظهر في قائمة صاحب الوظيفة نفسه
  const posterOwnAppsRes = await request(app)
    .get('/api/jobs/applications/mine')
    .set('Authorization', 'Bearer ' + poster.token);
  assert.equal(posterOwnAppsRes.body.items.length, 0);
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.jobApplication.deleteMany({ where: { applicantId: id } });
    await prisma.jobPosting.deleteMany({ where: { posterId: id } });
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
