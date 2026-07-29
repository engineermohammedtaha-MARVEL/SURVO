const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

const STATUSES = ['stolen', 'lost'];

async function create(req, res) {
  const { category, brand, serialNumber, status, details, contactPhone, policeReportUrl, ownershipDocUrl } = req.body;

  if (!category || !brand || !serialNumber || !status) {
    throw new ApiError(400, 'نوع الجهاز والماركة والرقم التسلسلي وحالة البلاغ مطلوبين');
  }
  if (!STATUSES.includes(status)) {
    throw new ApiError(400, 'حالة البلاغ غير صحيحة');
  }

  const report = await prisma.deviceReport.create({
    data: {
      reporterId: req.user.id,
      category,
      brand: brand.trim(),
      serialNumber: serialNumber.trim(),
      status,
      details: details || undefined,
      contactPhone: contactPhone || undefined,
      policeReportUrl: policeReportUrl || undefined,
      ownershipDocUrl: ownershipDocUrl || undefined,
    },
  });

  res.status(201).json({ success: true, report });
}

async function myReports(req, res) {
  const reports = await prisma.deviceReport.findMany({
    where: { reporterId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, reports });
}

const CATEGORY_LABELS_AR = {
  totalstation: 'توتال ستاشن',
  gps: 'GPS',
  level: 'ميزان',
  laser: 'ليزر سكانر',
  accessories: 'اكسسوارات',
};

async function lookup(req, res) {
  const { serialNumber, brand, category } = req.query;
  if (!serialNumber || !serialNumber.trim()) {
    throw new ApiError(400, 'اكتب الرقم التسلسلي');
  }
  if (!category || !category.trim()) {
    throw new ApiError(400, 'اختار نوع الجهاز');
  }
  if (!brand || !brand.trim()) {
    throw new ApiError(400, 'اختار ماركة الجهاز');
  }

  const report = await prisma.deviceReport.findFirst({
    where: {
      serialNumber: { equals: serialNumber.trim(), mode: 'insensitive' },
      category: category.trim(),
      brand: { equals: brand.trim(), mode: 'insensitive' },
      moderationStatus: 'approved',
    },
    orderBy: { createdAt: 'desc' },
    include: { reporter: { select: { id: true, fullName: true, phone: true } } },
  });

  if (!report) {
    return res.json({ success: true, clean: true });
  }

  const statusLabel = report.status === 'stolen' ? 'مسروق' : 'مفقود';
  const deviceLabel = (CATEGORY_LABELS_AR[report.category] || report.category) + (report.brand ? ' — ' + report.brand : '');

  // إشعار لصاحب البلاغ (لو المستعلم مسجل دخول ومش هو نفسه) — بنديله اسم ورقم المستعلم يقدر يتواصل بيه
  if (req.user && req.user.id !== report.reporterId) {
    const inquirer = await prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true, phone: true } });
    if (inquirer) {
      await prisma.notification.create({
        data: {
          userId: report.reporterId,
          title: 'حد بيستعلم عن جهازك المتبلّغ عنه',
          body: 'المستخدم "' + inquirer.fullName + '" (' + inquirer.phone + ') استعلم عن ' + deviceLabel + ' اللي بلّغت عنه كـ' + statusLabel + '. تقدر تتواصل معه من هنا.',
          contactUserId: req.user.id,
        },
      });
    }
  }

  // إشعار للمستعلم نفسه (سجل دائم غير التحذير اللي بيظهر على الشاشة)
  if (req.user) {
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: 'تحذير: الجهاز ده مبلّغ عنه',
        body: deviceLabel + ' بالرقم التسلسلي ' + report.serialNumber + ' مبلّغ عنه كـ' + statusLabel + '.',
      },
    });
  }

  res.json({
    success: true,
    clean: false,
    status: report.status,
    category: report.category,
    brand: report.brand,
    reportedAt: report.createdAt,
  });
}

module.exports = { create, myReports, lookup, STATUSES };
