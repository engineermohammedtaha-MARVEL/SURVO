const API_BASE = location.origin + '/api/admin';

// أي نص جاي من مستخدم (اسم، بايو، وصف إعلان، إلخ) لازم يعدي من هنا قبل ما يتحط
// في innerHTML، عشان نمنع حقن HTML/script يتنفذ في جلسة الأدمن نفسها
function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

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

function getAdminToken() {
  return localStorage.getItem('survo_admin_token') || '';
}

function setAdminToken(token) {
  if (token) localStorage.setItem('survo_admin_token', token);
  else localStorage.removeItem('survo_admin_token');
}

function showLoggedOutUI() {
  document.getElementById('adminLoginBox').style.display = '';
  document.getElementById('dashboardWrap').style.display = 'none';
}

function showLoggedInUI() {
  document.getElementById('adminLoginBox').style.display = 'none';
  document.getElementById('dashboardWrap').style.display = '';
}

async function apiCall(path, options) {
  const res = await fetch(API_BASE + path, Object.assign({}, options, {
    headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + getAdminToken() }, (options && options.headers) || {}),
  }));
  const data = await res.json().catch(function () { return null; });
  if (res.status === 401 || res.status === 403) {
    setAdminToken(null);
    showLoggedOutUI();
  }
  if (!res.ok) throw new Error((data && data.message) || 'حصل خطأ');
  return data;
}

async function adminLogin() {
  const errorBox = document.getElementById('errorBox');
  errorBox.textContent = '';
  const identifier = document.getElementById('adminLoginPhone').value.trim();
  const password = document.getElementById('adminLoginPassword').value;
  if (!identifier || !password) {
    errorBox.textContent = 'اكتب رقم الموبايل أو الإيميل وكلمة المرور';
    return;
  }
  try {
    const res = await fetch(location.origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: identifier, password }),
    });
    const data = await res.json().catch(function () { return null; });
    if (!res.ok || !data || !data.token) throw new Error((data && data.message) || 'فشل تسجيل الدخول');
    setAdminToken(data.token);
    document.getElementById('adminLoginPassword').value = '';
    showLoggedInUI();
    loadAll();
  } catch (err) {
    errorBox.textContent = err.message || 'فشل تسجيل الدخول';
  }
}

function adminLogout() {
  setAdminToken(null);
  showLoggedOutUI();
}

// مستندات التوثيق الحساسة بترفع محمية (authenticated) — الرابط المخزّن لوحده
// مش هيشتغل، لازم نطلب توقيع جديد من السيرفر كل مرة قبل ما نفتحه
async function openSignedDoc(rawUrl) {
  // بنفتح تاب فاضي فورًا (جوه نفس الـ click) عشان المتصفح مايحجبهوش كـ popup —
  // لو فتحناه بعد الـ await هيتحجب لأنه مبقاش "استجابة مباشرة" لضغطة المستخدم
  const newTab = window.open('', '_blank');
  if (newTab) newTab.opener = null;
  try {
    const data = await apiCall('/signed-url?url=' + encodeURIComponent(rawUrl));
    if (newTab) newTab.location.href = data.url;
    else window.open(data.url, '_blank', 'noopener');
  } catch (err) {
    if (newTab) newTab.close();
    alert(err.message || 'تعذر فتح المستند');
  }
}

// بيدور على كل رابط مستند جوه الكونتينر ده ويخليه يفتح عن طريق openSignedDoc
// بدل ما يكون href مباشر (اللي مش هيشتغل أصلًا لو المستند authenticated)
function wireDocLinks(container) {
  container.querySelectorAll('.doc-link[data-doc-url]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openSignedDoc(el.getAttribute('data-doc-url'));
    });
  });
}

function cardEl(u) {
  const date = new Date(u.createdAt).toLocaleString('ar-EG');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'card-' + u.id;

  const docs = Object.keys(DOC_LABELS).filter(function (key) { return u[key]; });

  card.innerHTML =
    '<div class="card-header">' +
    '<div class="card-name">' + escapeHtml(u.fullName) + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span>📱 ' + escapeHtml(u.phone) + '</span>' +
    '<span>✉️ ' + escapeHtml(u.email || '—') + '</span>' +
    '<span>' + escapeHtml(ACCOUNT_TYPE_LABELS[u.accountType] || u.accountType) + '</span>' +
    '<span>📍 ' + escapeHtml(u.governorate || '—') + '</span>' +
    '</div>' +
    (u.bio ? '<div class="card-bio">' + escapeHtml(u.bio) + '</div>' : '') +
    (u.specialties && u.specialties.length
      ? '<div class="card-tags">' + u.specialties.map(function (s) { return '<span class="tag">' + escapeHtml(s) + '</span>'; }).join('') + '</div>'
      : '') +
    '<div class="docs-label">المستندات المرفوعة</div>' +
    (docs.length
      ? '<div class="docs-row">' + docs.map(function (key) {
          return '<a class="doc-link" href="#" data-doc-url="' + escapeHtml(u[key]) + '">' + DOC_LABELS[key] + '</a>';
        }).join('') + '</div>'
      : '<div class="no-docs">⚠ المستخدم لسه ما رفعش أي مستندات توثيق</div>') +
    '<div class="actions"></div>';
  wireDocLinks(card);

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

function verificationCardEl(u) {
  const date = new Date(u.updatedAt).toLocaleString('ar-EG');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'verification-' + u.id;

  const docs = Object.keys(DOC_LABELS).filter(function (key) { return u[key]; });

  card.innerHTML =
    '<div class="card-header">' +
    '<div class="card-name">' + escapeHtml(u.fullName) + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span>📱 ' + escapeHtml(u.phone) + '</span>' +
    '<span>✉️ ' + escapeHtml(u.email || '—') + '</span>' +
    '<span>' + escapeHtml(ACCOUNT_TYPE_LABELS[u.accountType] || u.accountType) + '</span>' +
    '<span>📍 ' + escapeHtml(u.governorate || '—') + '</span>' +
    '</div>' +
    '<div class="docs-label">المستندات المرفوعة</div>' +
    (docs.length
      ? '<div class="docs-row">' + docs.map(function (key) {
          return '<a class="doc-link" href="#" data-doc-url="' + escapeHtml(u[key]) + '">' + DOC_LABELS[key] + '</a>';
        }).join('') + '</div>'
      : '<div class="no-docs">⚠ المستخدم لسه ما رفعش أي مستندات</div>') +
    '<div class="actions"></div>';
  wireDocLinks(card);

  const actionsCell = card.querySelector('.actions');
  const approveBtn = document.createElement('button');
  approveBtn.className = 'approve';
  approveBtn.textContent = '✓ توثيق';
  approveBtn.addEventListener('click', function () { actVerification(u.id, 'approve'); });

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'reject';
  rejectBtn.textContent = '✕ رفض';
  rejectBtn.addEventListener('click', function () {
    const reason = prompt('اكتب سبب رفض طلب التوثيق (هيتبعت للمستخدم كإشعار):', '');
    if (reason === null) return;
    actVerification(u.id, 'reject', reason);
  });

  actionsCell.appendChild(approveBtn);
  actionsCell.appendChild(rejectBtn);
  return card;
}

async function loadVerifications() {
  const errorBox = document.getElementById('errorBox');
  try {
    const data = await apiCall('/verifications/pending');
    const wrap = document.getElementById('verificationsWrap');
    const empty = document.getElementById('verificationsEmptyBox');
    wrap.innerHTML = '';
    if (!data.users.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    data.users.forEach(function (u) { wrap.appendChild(verificationCardEl(u)); });
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر تحميل طلبات التوثيق — تأكد من صحة المفتاح';
  }
}

async function actVerification(id, action, reason) {
  try {
    await apiCall('/verifications/' + id + '/' + action, {
      method: 'POST',
      body: action === 'reject' ? JSON.stringify({ reason: reason || '' }) : undefined,
    });
    const card = document.getElementById('verification-' + id);
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
    '<div class="card-name">' + escapeHtml(DEVICE_CATEGORY_LABELS[r.category] || r.category) + (r.brand ? ' — ' + escapeHtml(r.brand) : '') + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span class="report-status ' + escapeHtml(r.status) + '">' + (r.status === 'stolen' ? 'مسروق' : 'مفقود') + '</span>' +
    '<span>🔢 ' + escapeHtml(r.serialNumber) + '</span>' +
    '<span>👤 ' + escapeHtml(r.reporter ? r.reporter.fullName : '—') + '</span>' +
    '<span>📱 ' + escapeHtml(r.contactPhone || (r.reporter ? r.reporter.phone : '—')) + '</span>' +
    '</div>' +
    (r.details ? '<div class="card-bio">' + escapeHtml(r.details) + '</div>' : '') +
    '<div class="docs-label">المستندات المرفوعة</div>' +
    (docs.length
      ? '<div class="docs-row">' + docs.map(function (d) {
          return '<a class="doc-link" href="#" data-doc-url="' + escapeHtml(d[1]) + '">' + d[0] + '</a>';
        }).join('') + '</div>'
      : '<div class="no-docs">⚠ مفيش مستندات مرفوعة</div>') +
    '<div class="actions"></div>';
  wireDocLinks(card);

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
    '<div class="card-name">' + escapeHtml(item.title) + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span>' + escapeHtml(DEVICE_CATEGORY_LABELS[item.category] || item.category) + '</span>' +
    '<span>' + (item.listingType === 'rent' ? 'للإيجار' : 'للبيع') + '</span>' +
    (item.serialNumber ? '<span>🔢 ' + escapeHtml(item.serialNumber) + '</span>' : '') +
    '<span>👤 ' + escapeHtml(item.owner ? item.owner.fullName : '—') + '</span>' +
    '<span>📱 ' + escapeHtml(item.owner ? item.owner.phone : '—') + '</span>' +
    '</div>' +
    (item.description ? '<div class="card-bio">' + escapeHtml(item.description) + '</div>' : '') +
    '<div class="docs-label">المستندات والصور</div>' +
    (docs.length
      ? '<div class="docs-row">' + docs.map(function (d) {
          return '<a class="doc-link" href="#" data-doc-url="' + escapeHtml(d[1]) + '">' + d[0] + '</a>';
        }).join('') + '</div>'
      : '<div class="no-docs">⚠ مفيش صور أو مستندات مرفوعة</div>') +
    '<div class="actions"></div>';
  wireDocLinks(card);

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
    '<div class="card-name">' + escapeHtml(t.type || 'استفسار عام') + '</div>' +
    '<div class="card-date">' + date + '</div>' +
    '</div>' +
    '<div class="card-meta">' +
    '<span>👤 ' + escapeHtml(t.user ? t.user.fullName : '—') + '</span>' +
    '<span>📱 ' + escapeHtml(t.user ? t.user.phone : '—') + '</span>' +
    '<span>✉️ ' + escapeHtml(t.user && t.user.email ? t.user.email : '—') + '</span>' +
    '</div>' +
    '<div class="card-bio">' + escapeHtml(t.details) + '</div>' +
    '<div class="docs-label">المرفق</div>' +
    (t.attachmentUrl
      ? '<div class="docs-row"><a class="doc-link" href="#" data-doc-url="' + escapeHtml(t.attachmentUrl) + '">📎 عرض المرفق</a></div>'
      : '<div class="no-docs">⚠ مفيش مرفق</div>') +
    '<div class="actions"></div>';
  wireDocLinks(card);

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

// ============ التواصل مع مستخدم ============
let selectedUserForMessage = null;

function userResultRowEl(u) {
  const row = document.createElement('div');
  row.className = 'card';
  row.style.cursor = 'pointer';
  row.innerHTML =
    '<div class="card-header"><div class="card-name">' + escapeHtml(u.fullName) + '</div></div>' +
    '<div class="card-meta">' +
    '<span>📱 ' + escapeHtml(u.phone) + '</span>' +
    '<span>✉️ ' + escapeHtml(u.email || '—') + '</span>' +
    '<span>' + escapeHtml(ACCOUNT_TYPE_LABELS[u.accountType] || u.accountType) + '</span>' +
    '</div>';
  row.addEventListener('click', function () {
    selectedUserForMessage = u;
    document.getElementById('messageComposeTarget').textContent = 'الرسالة هتتبعت لـ: ' + u.fullName + ' (' + u.phone + ')';
    document.getElementById('messageComposeBox').style.display = 'block';
  });
  return row;
}

async function searchUsersUI() {
  const errorBox = document.getElementById('errorBox');
  const term = document.getElementById('userSearchInput').value.trim();
  const resultsWrap = document.getElementById('userSearchResults');
  resultsWrap.innerHTML = '';
  if (!term) return;
  try {
    const data = await apiCall('/users/search?q=' + encodeURIComponent(term));
    if (!data.users.length) {
      resultsWrap.innerHTML = '<div class="empty">مفيش مستخدمين مطابقين</div>';
      return;
    }
    data.users.forEach(function (u) { resultsWrap.appendChild(userResultRowEl(u)); });
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر البحث';
  }
}

async function sendAdminMessageUI() {
  const errorBox = document.getElementById('errorBox');
  const textEl = document.getElementById('adminMessageText');
  const body = textEl.value.trim();
  if (!selectedUserForMessage || !body) return;
  try {
    await apiCall('/messages', {
      method: 'POST',
      body: JSON.stringify({ userId: selectedUserForMessage.id, body }),
    });
    textEl.value = '';
    document.getElementById('messageComposeBox').style.display = 'none';
    document.getElementById('userSearchResults').innerHTML = '';
    document.getElementById('userSearchInput').value = '';
    selectedUserForMessage = null;
    loadAdminConversations();
    alert('تم إرسال الرسالة ✓');
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر إرسال الرسالة';
  }
}

// ============ محادثات الدعم الفني ============
let currentAdminConversationOtherUser = null;

function adminConversationRowEl(conv, supportUserId) {
  const other = conv.userAId === supportUserId ? conv.userB : conv.userA;
  const lastMsg = (conv.messages && conv.messages[0]) || null;
  const row = document.createElement('div');
  row.className = 'card';
  row.style.cursor = 'pointer';
  row.innerHTML =
    '<div class="card-header"><div class="card-name">' + escapeHtml(other.fullName) + '</div></div>' +
    '<div class="card-meta"><span>📱 ' + escapeHtml(other.phone) + '</span></div>' +
    (lastMsg ? '<div class="card-bio">' + escapeHtml(lastMsg.body) + '</div>' : '');
  row.addEventListener('click', function () { openAdminConversationThread(conv.id, other); });
  return row;
}

async function loadAdminConversations() {
  const errorBox = document.getElementById('errorBox');
  try {
    const data = await apiCall('/messages/conversations');
    const wrap = document.getElementById('adminConversationsWrap');
    const empty = document.getElementById('adminConversationsEmptyBox');
    wrap.innerHTML = '';
    if (!data.conversations.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    data.conversations.forEach(function (c) { wrap.appendChild(adminConversationRowEl(c, data.supportUserId)); });
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر تحميل محادثات الدعم الفني';
  }
}

async function openAdminConversationThread(conversationId, otherUser) {
  const errorBox = document.getElementById('errorBox');
  currentAdminConversationOtherUser = otherUser;
  const threadBox = document.getElementById('adminConversationThreadBox');
  const messagesWrap = document.getElementById('adminConversationMessages');
  document.getElementById('adminConversationThreadTitle').textContent = 'المحادثة مع ' + otherUser.fullName;
  threadBox.style.display = 'block';
  try {
    const data = await apiCall('/messages/conversations/' + conversationId);
    messagesWrap.innerHTML = data.messages.map(function (m) {
      const isSupport = m.senderId !== otherUser.id;
      return '<div class="card" style="' + (isSupport ? 'background:#EFF6FF;' : '') + '"><b>' + (isSupport ? 'الدعم الفني' : escapeHtml(otherUser.fullName)) + ':</b> ' + escapeHtml(m.body) + '</div>';
    }).join('');
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر تحميل المحادثة';
  }
}

async function sendAdminReplyUI() {
  const errorBox = document.getElementById('errorBox');
  const textEl = document.getElementById('adminConversationReplyText');
  const body = textEl.value.trim();
  if (!currentAdminConversationOtherUser || !body) return;
  try {
    await apiCall('/messages', {
      method: 'POST',
      body: JSON.stringify({ userId: currentAdminConversationOtherUser.id, body }),
    });
    textEl.value = '';
    loadAdminConversations();
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر إرسال الرد';
  }
}

document.getElementById('userSearchBtn').addEventListener('click', searchUsersUI);
document.getElementById('sendAdminMessageBtn').addEventListener('click', sendAdminMessageUI);
document.getElementById('adminConversationReplyBtn').addEventListener('click', sendAdminReplyUI);

function loadAll() {
  loadUsers();
  loadVerifications();
  loadDeviceReports();
  loadPendingEquipment();
  loadSupportTickets();
  loadAdminConversations();
}

document.getElementById('loadBtn').addEventListener('click', loadAll);
document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);
document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);
document.getElementById('adminLoginPassword').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') adminLogin();
});

window.addEventListener('DOMContentLoaded', function () {
  if (getAdminToken()) {
    showLoggedInUI();
    loadAll();
  } else {
    showLoggedOutUI();
  }
});
