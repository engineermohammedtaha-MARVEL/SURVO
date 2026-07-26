const API_BASE = location.origin + '/api/admin';

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

function rowHTML(u) {
  const date = new Date(u.createdAt).toLocaleString('ar-EG');
  const tr = document.createElement('tr');
  tr.id = 'row-' + u.id;
  tr.innerHTML =
    '<td>' + u.fullName + '</td>' +
    '<td>' + u.phone + '</td>' +
    '<td>' + u.accountType + '</td>' +
    '<td>' + (u.governorate || '—') + '</td>' +
    '<td>' + date + '</td>' +
    '<td class="actions"></td>';

  const actionsCell = tr.querySelector('.actions');
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
  return tr;
}

async function loadUsers() {
  const errorBox = document.getElementById('errorBox');
  errorBox.textContent = '';
  try {
    const data = await apiCall('/users/pending');
    const table = document.getElementById('usersTable');
    const empty = document.getElementById('emptyBox');
    const body = document.getElementById('usersBody');
    body.innerHTML = '';
    if (!data.users.length) {
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    table.style.display = 'table';
    data.users.forEach(function (u) { body.appendChild(rowHTML(u)); });
  } catch (err) {
    errorBox.textContent = err.message || 'تعذر تحميل البيانات — تأكد من صحة المفتاح';
  }
}

async function act(id, action) {
  try {
    await apiCall('/users/' + id + '/' + action, { method: 'POST' });
    const row = document.getElementById('row-' + id);
    if (row) row.remove();
  } catch (err) {
    alert(err.message || 'حصل خطأ');
  }
}

document.getElementById('loadBtn').addEventListener('click', loadUsers);

window.addEventListener('DOMContentLoaded', function () {
  const saved = localStorage.getItem('survo_admin_secret');
  if (saved) {
    document.getElementById('secretInput').value = saved;
    loadUsers();
  }
});
