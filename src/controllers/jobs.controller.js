const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

const JOB_TYPES = ['engineer', 'surveyor', 'assistant', 'totalstation', 'gps', 'level'];
const WORK_TYPES = ['full', 'daily', 'remote'];

async function list(req, res) {
  const { jobType, workType, governorate, status = 'open' } = req.query;
  const items = await prisma.jobPosting.findMany({
    where: {
      ...(jobType && { jobType }),
      ...(workType && { workType }),
      ...(governorate && { governorate }),
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      poster: { select: { id: true, fullName: true, phone: true, verification: true, avatarUrl: true } },
    },
  });
  res.json({ success: true, items });
}

async function getOne(req, res) {
  const item = await prisma.jobPosting.findUnique({
    where: { id: req.params.id },
    include: {
      poster: { select: { id: true, fullName: true, phone: true, verification: true, avatarUrl: true } },
    },
  });
  if (!item) throw new ApiError(404, 'الوظيفة غير موجودة');
  res.json({ success: true, item });
}

async function create(req, res) {
  const { title, jobType, workType, governorate, description, salary } = req.body;

  if (!title || !jobType || !workType || !governorate) {
    throw new ApiError(400, 'اسم الوظيفة ونوعها ونوع الدوام والمحافظة مطلوبين');
  }
  if (!JOB_TYPES.includes(jobType)) throw new ApiError(400, 'نوع الوظيفة غير صحيح');
  if (!WORK_TYPES.includes(workType)) throw new ApiError(400, 'نوع الدوام غير صحيح');

  const item = await prisma.jobPosting.create({
    data: { posterId: req.user.id, title, jobType, workType, governorate, description, salary },
  });

  res.status(201).json({ success: true, item });
}

async function remove(req, res) {
  const existing = await prisma.jobPosting.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'الوظيفة غير موجودة');
  if (existing.posterId !== req.user.id) throw new ApiError(403, 'مش مسموح لك تحذف الوظيفة دي');

  await prisma.jobPosting.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}

/**
 * التقديم على الوظيفة بيتم فعليًا عن طريق المراسلة المباشرة أو الاتصال
 * (مش نموذج تقديم رسمي). الـ endpoint ده بيسجل نية التقديم فقط عشان
 * صاحب الإعلان يشوف مين اهتم بالوظيفة، وبيرجّع بيانات التواصل
 * (تليفون صاحب الإعلان) عشان الفرونت يفتح شات أو اتصال مباشرة.
 */
async function applyOrContact(req, res) {
  const { message } = req.body;
  const job = await prisma.jobPosting.findUnique({
    where: { id: req.params.id },
    include: { poster: { select: { id: true, fullName: true, phone: true } } },
  });
  if (!job) throw new ApiError(404, 'الوظيفة غير موجودة');
  if (job.posterId === req.user.id) throw new ApiError(400, 'مش هتقدر تتقدم لوظيفتك انت');

  const application = await prisma.jobApplication.upsert({
    where: { jobId_applicantId: { jobId: job.id, applicantId: req.user.id } },
    update: { message },
    create: { jobId: job.id, applicantId: req.user.id, message },
  });

  res.status(201).json({
    success: true,
    application,
    contact: { userId: job.poster.id, fullName: job.poster.fullName, phone: job.poster.phone },
  });
}

// بيرجع الوظايف اللي المستخدم اتقدملها (سجّل نية تقديم من زرار "تقديم/تواصل")
async function myApplications(req, res) {
  const items = await prisma.jobApplication.findMany({
    where: { applicantId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      job: {
        include: {
          poster: { select: { id: true, fullName: true, phone: true, verification: true } },
        },
      },
    },
  });
  res.json({ success: true, items });
}

module.exports = { list, getOne, create, remove, applyOrContact, myApplications, JOB_TYPES, WORK_TYPES };
