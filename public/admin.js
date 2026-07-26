const API_BASE = location.origin + '/api/admin';

const ACCOUNT_TYPE_LABELS = {
  engineer: 'مهندس مساحة',
  specialist: 'أخصائي مساحة',
  surveyor_academic: 'مساح عام أكاديمي',
  surveyor_professional: 'مساح مهني',
  assistant: 'مساعد مساح',
  office: 'مكتب / شركة',
  general: 'تسجيل عام',
};

const DOC_LABELS = {
  nationalIdUrl: '🪪 بطاقة الرقم القومي',
  personalPhotoUrl: '🙂 صورة شخصية',
  qualificationUrl: '🎓 المؤهل الدراسي',
  unionCardUrl: '📜 كارنيه النقابة',
  commercialRecordUrl: '📄 السجل التجاري',
};

function getSecret() {
  const s = document.getElementById('secretInput').value.trim();
  if (s) localStorage.setItem('survo_admin_secret', s);
  return s || localStorage.getItem('survo_admin_secret') || '';
}

async function apiCall(path, options) {
  const res = await fetch(API_BASE + path, Object.assign({}, options, {
    headers: Object.assign({ 'Content-Type': 'application/json', 'X-Admin-Secret': getSecret() }, (options && options.headers) || {}),
  }));
  const data = await res.json().catch(function () { return null; });
  if (!res.ok) throw new Error((data && data.message) || 'حصل خطأ');
  return data;
}

function cardEl(u) {
  const date = new Date(u.createdAt).toLocaleString('ar-EG');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'card-' + u.id;

  const docs = Object.keys(DOC_LABELS).filter(function (key) { return u[key]; });

  card.innerHTML =
    '<div class="card-header">' +
    '<div class="card-name">' + u.fullName + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span>📱 ' + u.phone + '</span>' +
    '<span>✉️ ' + (u.email || '—') + '</span>' +
    '<span>' + (ACCOUNT_TYPE_LABELS[u.accountType] || u.accountType) + '</span>' +
    '<span>📍 ' + (u.governorate || '—') + '</span>' +
    '</div>' +
    (u.bio ? '<div class="card-bio">' + u.bio + '</div>' : '') +
    (u.specialties && u.specialties.length
      ? '<div class="card-tags">' + u.specialties.map(function (s) { return '<span class="tag">' + s + '</span>'; }).join('') + '</div>'
      : '') +
    '<div class="docs-label">المستندات المرفوعة</div>' +
    (docs.length
      ? '<div class="docs-row">' + docs.map(function (key) {
          return '<a class="doc-link" target="_blank" rel="noopener" href="' + u[key] + '">' + DOC_LABELS[key] + '</a>';
        }).join('') + '</div>'
      : '<div class="no-docs">⚠ المستخدم لسه ما رفعش أي مستندات توثيق</div>') +
    '<div class="actions"></div>';

  const actionsCell = card.querySelector('.actions');
  const approveBtn = document.createElement('button');
  approveBtn.className = 'approve';
  approveBtn.textContent = '✓ موافقة';
  approveBtn.addEventListener('click', function () { act(u.id, 'approve'); });

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'reject';
  rejectBtn.textContent = '✕ رفض';
  rejectBtn.addEventListener('click', function () { act(u.id, 'reject'); });

  actionsCell.appendChild(approveBtn);
  actionsCell.appendChild(rejectBtn);
  return card;
}

async function loadUsers() {
  const errorBox = document.getElementById('errorBox');
  errorBox.textContent = '';
  try {
    const data = await apiCall('/users/pending');
    const wrap = document.getElementById('cardsWrap');
    const empty = document.getElementById('emptyBox');
    wrap.innerHTML = '';
    if (!data.users.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    data.users.forEach(function (u) { wrap.appendChild(cardEl(u)); });
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر تحميل البيانات — تأكد من صحة المفتاح';
  }
}

async function act(id, action) {
  try {
    await apiCall('/users/' + id + '/' + action, { method: 'POST' });
    const card = document.getElementById('card-' + id);
    if (card) card.remove();
  } catch (err) {
    alert(err.message || 'حصل خطأ');
  }
}

const DEVICE_CATEGORY_LABELS = {
  totalstation: 'توتال ستاشن',
  gps: 'GPS',
  level: 'ميزان',
  laser: 'ليزر سكانر',
  accessories: 'اكسسوارات',
};

function reportCardEl(r) {
  const date = new Date(r.createdAt).toLocaleString('ar-EG');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'report-' + r.id;

  const docs = [];
  if (r.policeReportUrl) docs.push(['📎 محضر الشرطة', r.policeReportUrl]);
  if (r.ownershipDocUrl) docs.push(['📄 سند الملكية', r.ownershipDocUrl]);

  card.innerHTML =
    '<div class="card-header">' +
    '<div class="card-name">' + (DEVICE_CATEGORY_LABELS[r.category] || r.category) + (r.brand ? ' — ' + r.brand : '') + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span class="report-status ' + r.status + '">' + (r.status === 'stolen' ? 'مسروق' : 'مفقود') + '</span>' +
    '<span>🔢 ' + r.serialNumber + '</span>' +
    '<span>👤 ' + (r.reporter ? r.reporter.fullName : '—') + '</span>' +
    '<span>📱 ' + (r.contactPhone || (r.reporter ? r.reporter.phone : '—')) + '</span>' +
    '</div>' +
    (r.details ? '<div class="card-bio">' + r.details + '</div>' : '') +
    '<div class="docs-label">المستندات المرفوعة</div>' +
    (docs.length
      ? '<div class="docs-row">' + docs.map(function (d) {
          return '<a class="doc-link" target="_blank" rel="noopener" href="' + d[1] + '">' + d[0] + '</a>';
        }).join('') + '</div>'
      : '<div class="no-docs">⚠ مفيش مستندات مرفوعة</div>') +
    '<div class="actions"></div>';

  const actionsCell = card.querySelector('.actions');
  const approveBtn = document.createElement('button');
  approveBtn.className = 'approve';
  approveBtn.textContent = '✓ اعتماد البلاغ';
  approveBtn.addEventListener('click', function () { actReport(r.id, 'approve'); });

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'reject';
  rejectBtn.textContent = '✕ رفض';
  rejectBtn.addEventListener('click', function () { actReport(r.id, 'reject'); });

  actionsCell.appendChild(approveBtn);
  actionsCell.appendChild(rejectBtn);
  return card;
}

async function loadDeviceReports() {
  const errorBox = document.getElementById('errorBox');
  try {
    const data = await apiCall('/device-reports/pending');
    const wrap = document.getElementById('reportsWrap');
    const empty = document.getElementById('reportsEmptyBox');
    wrap.innerHTML = '';
    if (!data.reports.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    data.reports.forEach(function (r) { wrap.appendChild(reportCardEl(r)); });
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر تحميل البلاغات — تأكد من صحة المفتاح';
  }
}

async function actReport(id, action) {
  try {
    await apiCall('/device-reports/' + id + '/' + action, { method: 'POST' });
    const card = document.getElementById('report-' + id);
    if (card) card.remove();
  } catch (err) {
    alert(err.message || 'حصل خطأ');
  }
}

function loadAll() {
  loadUsers();
  loadDeviceReports();
}

document.getElementById('loadBtn').addEventListener('click', loadAll);

window.addEventListener('DOMContentLoaded', function () {
  const saved = localStorage.getItem('survo_admin_secret');
  if (saved) {
    document.getElementById('secretInput').value = saved;
    loadAll();
  }
});
