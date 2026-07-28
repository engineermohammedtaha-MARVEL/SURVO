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
  rejectBtn.addEventListener('click', function () {
    const reason = prompt('اكتب سبب رفض الحساب (هيتبعت للمستخدم كإشعار):', '');
    if (reason === null) return;
    act(u.id, 'reject', reason);
  });

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

async function act(id, action, reason) {
  try {
    await apiCall('/users/' + id + '/' + action, {
      method: 'POST',
      body: action === 'reject' ? JSON.stringify({ reason: reason || '' }) : undefined,
    });
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
  rejectBtn.addEventListener('click', function () {
    const reason = prompt('اكتب سبب رفض البلاغ (هيتبعت للمُبلّغ كإشعار):', '');
    if (reason === null) return;
    actReport(r.id, 'reject', reason);
  });

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

async function actReport(id, action, reason) {
  try {
    await apiCall('/device-reports/' + id + '/' + action, {
      method: 'POST',
      body: action === 'reject' ? JSON.stringify({ reason: reason || '' }) : undefined,
    });
    const card = document.getElementById('report-' + id);
    if (card) card.remove();
  } catch (err) {
    alert(err.message || 'حصل خطأ');
  }
}

function equipmentCardEl(item) {
  const date = new Date(item.createdAt).toLocaleString('ar-EG');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'equipment-' + item.id;

  const docs = [];
  if (item.ownershipDocUrl) docs.push(['📄 سند الملكية', item.ownershipDocUrl]);
  if (item.serialNumberPhotoUrl) docs.push(['🔢 صورة الرقم التسلسلي', item.serialNumberPhotoUrl]);
  if (item.images && item.images.length) {
    item.images.forEach(function (url, i) { docs.push(['🖼️ صورة ' + (i + 1), url]); });
  }

  card.innerHTML =
    '<div class="card-header">' +
    '<div class="card-name">' + item.title + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span>' + (DEVICE_CATEGORY_LABELS[item.category] || item.category) + '</span>' +
    '<span>' + (item.listingType === 'rent' ? 'للإيجار' : 'للبيع') + '</span>' +
    (item.serialNumber ? '<span>🔢 ' + item.serialNumber + '</span>' : '') +
    '<span>👤 ' + (item.owner ? item.owner.fullName : '—') + '</span>' +
    '<span>📱 ' + (item.owner ? item.owner.phone : '—') + '</span>' +
    '</div>' +
    (item.description ? '<div class="card-bio">' + item.description + '</div>' : '') +
    '<div class="docs-label">المستندات والصور</div>' +
    (docs.length
      ? '<div class="docs-row">' + docs.map(function (d) {
          return '<a class="doc-link" target="_blank" rel="noopener" href="' + d[1] + '">' + d[0] + '</a>';
        }).join('') + '</div>'
      : '<div class="no-docs">⚠ مفيش صور أو مستندات مرفوعة</div>') +
    '<div class="actions"></div>';

  const actionsCell = card.querySelector('.actions');
  const approveBtn = document.createElement('button');
  approveBtn.className = 'approve';
  approveBtn.textContent = '✓ نشر الإعلان';
  approveBtn.addEventListener('click', function () { actEquipment(item.id, 'approve'); });

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'reject';
  rejectBtn.textContent = '✕ رفض';
  rejectBtn.addEventListener('click', function () {
    const reason = prompt('اكتب سبب رفض الإعلان (هيتبعت للمستخدم كإشعار):', '');
    if (reason === null) return;
    actEquipment(item.id, 'reject', reason);
  });

  actionsCell.appendChild(approveBtn);
  actionsCell.appendChild(rejectBtn);
  return card;
}

async function loadPendingEquipment() {
  const errorBox = document.getElementById('errorBox');
  try {
    const data = await apiCall('/equipment/pending');
    const wrap = document.getElementById('equipmentWrap');
    const empty = document.getElementById('equipmentEmptyBox');
    wrap.innerHTML = '';
    if (!data.items.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    data.items.forEach(function (item) { wrap.appendChild(equipmentCardEl(item)); });
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر تحميل الإعلانات — تأكد من صحة المفتاح';
  }
}

async function actEquipment(id, action, reason) {
  try {
    await apiCall('/equipment/' + id + '/' + action, {
      method: 'POST',
      body: action === 'reject' ? JSON.stringify({ reason: reason || '' }) : undefined,
    });
    const card = document.getElementById('equipment-' + id);
    if (card) card.remove();
  } catch (err) {
    alert(err.message || 'حصل خطأ');
  }
}

function ticketCardEl(t) {
  const date = new Date(t.createdAt).toLocaleString('ar-EG');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'ticket-' + t.id;

  card.innerHTML =
    '<div class="card-header">' +
    '<div class="card-name">' + (t.type || 'استفسار عام') + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span>👤 ' + (t.user ? t.user.fullName : '—') + '</span>' +
    '<span>📱 ' + (t.user ? t.user.phone : '—') + '</span>' +
    '<span>✉️ ' + (t.user && t.user.email ? t.user.email : '—') + '</span>' +
    '</div>' +
    '<div class="card-bio">' + t.details + '</div>' +
    '<div class="docs-label">المرفق</div>' +
    (t.attachmentUrl
      ? '<div class="docs-row"><a class="doc-link" target="_blank" rel="noopener" href="' + t.attachmentUrl + '">📎 عرض المرفق</a></div>'
      : '<div class="no-docs">⚠ مفيش مرفق</div>') +
    '<div class="actions"></div>';

  const actionsCell = card.querySelector('.actions');
  const resolveBtn = document.createElement('button');
  resolveBtn.className = 'approve';
  resolveBtn.textContent = '✓ تم الحل';
  resolveBtn.addEventListener('click', function () { actTicket(t.id); });

  actionsCell.appendChild(resolveBtn);
  return card;
}

async function loadSupportTickets() {
  const errorBox = document.getElementById('errorBox');
  try {
    const data = await apiCall('/support-tickets/open');
    const wrap = document.getElementById('ticketsWrap');
    const empty = document.getElementById('ticketsEmptyBox');
    wrap.innerHTML = '';
    if (!data.tickets.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    data.tickets.forEach(function (t) { wrap.appendChild(ticketCardEl(t)); });
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر تحميل رسائل الدعم الفني — تأكد من صحة المفتاح';
  }
}

async function actTicket(id) {
  try {
    await apiCall('/support-tickets/' + id + '/resolve', { method: 'POST' });
    const card = document.getElementById('ticket-' + id);
    if (card) card.remove();
  } catch (err) {
    alert(err.message || 'حصل خطأ');
  }
}

function loadAll() {
  loadUsers();
  loadDeviceReports();
  loadPendingEquipment();
  loadSupportTickets();
}

document.getElementById('loadBtn').addEventListener('click', loadAll);

window.addEventListener('DOMContentLoaded', function () {
  const saved = localStorage.getItem('survo_admin_secret');
  if (saved) {
    document.getElementById('secretInput').value = saved;
    loadAll();
  }
});
