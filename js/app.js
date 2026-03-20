// ============================================================
//  NEU Library Visitor Log — app.js
//  Firebase Auth + Firestore logic
// ============================================================

// ── FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey:            "AIzaSyD1DzTboqJzSJYACL4CS9MnARV_XoP-Afc",
  authDomain:        "neu-library-visitor-log-57a04.firebaseapp.com",
  projectId:         "neu-library-visitor-log-57a04",
  storageBucket:     "neu-library-visitor-log-57a04.firebasestorage.app",
  messagingSenderId: "117874125605",
  appId:             "1:117874125605:web:d307e338c1f8a85827c8cc",
  measurementId:     "G-5ZCTDZM3HF"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── ROLE CONFIGURATION ──
const ADMIN_EMAILS = [
  "jcesperanza@neu.edu.ph",
  "bernard.lorenzo@neu.edu.ph"
];

function isAdmin(email) {
  return ADMIN_EMAILS.includes((email || '').toLowerCase().trim());
}

function isNEUEmail(email) {
  return (email || '').toLowerCase().trim().endsWith('@neu.edu.ph');
}

// ── AUTH STATE LISTENER ──
auth.onAuthStateChanged(user => {
  const onDashboard = window.location.pathname.includes('dashboard.html');
  const onIndex     = !onDashboard;

  if (user) {
    // Block non-NEU accounts
    if (!isNEUEmail(user.email)) {
      auth.signOut();
      showAlert('loginAlert', 'danger', '🚫 Access denied. Only NEU institutional accounts (@neu.edu.ph) are allowed.');
      return;
    }

    if (isAdmin(user.email)) {
      if (onIndex) {
        window.location.href = 'dashboard.html';
      } else {
        const el = document.getElementById('adminEmail');
        if (el) el.textContent = user.email;
        const av = document.getElementById('sidebarAvatar');
        if (av) av.textContent = getInitials(user.displayName || user.email);
        const sn = document.getElementById('sidebarName');
        if (sn) sn.textContent = user.displayName || user.email;
      }
    } else {
      if (onDashboard) {
        window.location.href = 'index.html';
      } else {
        showVisitorForm(user);
      }
    }
  } else {
    if (onDashboard) {
      window.location.href = 'index.html';
    }
  }
});

// ── GOOGLE SIGN-IN ──
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ hd: 'neu.edu.ph' });

  auth.signInWithPopup(provider)
    .then(result => {
      const email = result.user.email;
      if (!isNEUEmail(email)) {
        auth.signOut();
        showAlert('loginAlert', 'danger', '🚫 Access denied. Only NEU institutional accounts (@neu.edu.ph) are allowed.');
        return;
      }
    })
    .catch(err => {
      showAlert('loginAlert', 'danger', '⚠️ Login failed: ' + err.message);
    });
}

// ── EMAIL LOGIN ──
function loginWithEmail() {
  const email = (document.getElementById('emailInput')?.value || '').trim();
  if (!email) {
    showAlert('loginAlert', 'danger', 'Please enter your institutional email.');
    return;
  }
  if (!isNEUEmail(email)) {
    showAlert('loginAlert', 'danger', '🚫 Access denied. Only NEU email (@neu.edu.ph) is allowed.');
    return;
  }
  const mockUser = { email: email, displayName: email.split('@')[0], uid: 'email_' + email };
  if (isAdmin(email)) {
    window.location.href = 'dashboard.html';
  } else {
    showVisitorForm(mockUser);
  }
}

// ── SIGN OUT ──
function logout() {
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
}

// ── SHOW VISITOR FORM ──
function showVisitorForm(user) {
  const loginCard      = document.getElementById('loginCard');
  const heroSection    = document.getElementById('heroSection');
  const visitorSection = document.getElementById('visitorSection');

  if (loginCard)      loginCard.classList.add('hidden');
  if (heroSection)    heroSection.style.paddingBottom = '3rem';
  if (visitorSection) visitorSection.classList.remove('hidden');

  const headerInfo = document.getElementById('headerUserInfo');
  const btnLogout  = document.getElementById('btnLogout');
  // Header photo
  const hPhoto = document.getElementById("headerUserPhoto");
  const hName  = document.getElementById("headerUserName");
  const hInfo  = document.getElementById("headerUserInfo");
  if (hInfo) hInfo.classList.remove("hidden");
  if (hPhoto && user.photoURL) { hPhoto.src = user.photoURL; hPhoto.style.display = "block"; }
  if (hName) hName.textContent = user.displayName || user.email;
  if (btnLogout)  btnLogout.classList.remove('hidden');

  const avatarEl  = document.getElementById('userAvatar');
  const welcomeEl = document.getElementById('welcomeMsg');
  const emailEl   = document.getElementById('userEmail');
  const timeEl    = document.getElementById('visitTime');

  // Profile photo
  const photoEl = document.getElementById("userPhotoImg");
  if (photoEl && user.photoURL) {
    photoEl.src = user.photoURL;
    photoEl.classList.remove("hidden");
    const av = document.getElementById("userAvatar");
    if (av) av.style.display = "none";
  } else if (avatarEl) {
    avatarEl.textContent = getInitials(user.displayName || user.email);
  }
  if (welcomeEl) welcomeEl.textContent = 'Welcome to NEU Library!';
  if (emailEl)   emailEl.textContent   = user.displayName ? user.displayName + ' · ' + user.email : user.email;

  if (timeEl) {
    const now = new Date();
    timeEl.innerHTML = now.toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
      + '<br>' + now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
  }

  const visitorInput = document.getElementById('visitorID');
  if (visitorInput && user.email) visitorInput.value = user.email;
}

// ── LOG VISITOR ──
async function logVisitor() {
  const visitorID   = document.getElementById('visitorID')?.value.trim();
  const college     = document.getElementById('college')?.value;
  const purpose     = document.getElementById('purpose')?.value;
  const visitorType = document.getElementById('visitorType')?.value;
  const program     = document.getElementById('program')?.value;
  const yearLevel   = document.getElementById('yearLevel')?.value;

  if (!visitorID || !college || !purpose || !visitorType) {
    showAlert('formAlert', 'danger', '⚠️ Please fill in all required fields.');
    return;
  }

  const blockedSnap = await db.collection('blockedUsers').doc(visitorID).get();
  if (blockedSnap.exists && blockedSnap.data().blocked) {
    showAlert('formAlert', 'danger', '🚫 Your account has been blocked. Please contact the librarian.');
    return;
  }

  const btn  = document.getElementById('submitBtn');
  const text = document.getElementById('submitBtnText');
  const spin = document.getElementById('submitSpinner');
  if (btn)  btn.disabled = true;
  if (text) text.classList.add('hidden');
  if (spin) spin.classList.remove('hidden');

  const isEmployee = (visitorType === 'faculty' || visitorType === 'staff');

  db.collection('visitors').add({
    visitorID:   visitorID,
    college:     college,
    purpose:     purpose,
    visitorType: visitorType,
    isEmployee:  isEmployee,
    program:     program || "N/A",
    yearLevel:   yearLevel || "N/A",
    timestamp:   firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    showAlert('formAlert', 'success', '✅ Visit logged successfully! Thank you for visiting the NEU Library.');
    document.getElementById('visitorID').value   = auth.currentUser?.email || '';
    document.getElementById('college').value     = '';
    document.getElementById('purpose').value     = '';
    document.getElementById('visitorType').value = 'student';
  })
  .catch(err => {
    showAlert('formAlert', 'danger', '❌ Error logging visit: ' + err.message);
  })
  .finally(() => {
    if (btn)  btn.disabled = false;
    if (text) text.classList.remove('hidden');
    if (spin) spin.classList.add('hidden');
  });
}

// ── STATS STATE ──
let currentRange = 'today';
let allVisitorDocs = [];

function setRange(range, tabEl) {
  currentRange = range;
  document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  const customEl = document.getElementById('customDateRange');
  if (customEl) {
    range === 'custom' ? customEl.classList.remove('hidden') : customEl.classList.add('hidden');
  }
  if (range !== 'custom') loadStats();
}

function getDateRange() {
  const now = new Date();
  let startDate, endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  if (currentRange === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (currentRange === 'week') {
    const day = now.getDay();
    startDate = new Date(now);
    startDate.setDate(now.getDate() - day);
    startDate.setHours(0, 0, 0, 0);
  } else if (currentRange === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (currentRange === 'custom') {
    const fromVal = document.getElementById('dateFrom')?.value;
    const toVal   = document.getElementById('dateTo')?.value;
    startDate = fromVal ? new Date(fromVal + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
    endDate   = toVal   ? new Date(toVal   + 'T23:59:59') : endDate;
  }
  return { startDate, endDate };
}

// ── LOAD STATS ──
function loadStats() {
  const { startDate, endDate } = getDateRange();

  db.collection('visitors')
    .where('timestamp', '>=', startDate)
    .where('timestamp', '<=', endDate)
    .orderBy('timestamp', 'desc')
    .get()
    .then(snapshot => {
      allVisitorDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      computeAndRenderStats(allVisitorDocs);
      renderTable(allVisitorDocs);
      const lastUpdEl = document.getElementById('lastUpdated');
      if (lastUpdEl) lastUpdEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    })
    .catch(err => console.error('loadStats error:', err));

  const periodMap = { today:'Today', week:'This week', month:'This month', custom:'Selected range' };
  const el = document.getElementById('statPeriod');
  if (el) el.textContent = periodMap[currentRange] || '';
}

function computeAndRenderStats(docs) {
  const total     = docs.length;
  const students  = docs.filter(d => d.visitorType === 'student').length;
  const employees = docs.filter(d => d.isEmployee).length;

  const collegeCounts = {};
  docs.forEach(d => { if (d.college) collegeCounts[d.college] = (collegeCounts[d.college] || 0) + 1; });
  const topCollege = Object.entries(collegeCounts).sort((a,b) => b[1]-a[1])[0];

  setText('statTotal',           total);
  setText('statStudents',        students);
  setText('statEmployees',       employees);
  setText('statTopCollege',      topCollege ? topCollege[0] : '–');
  setText('statTopCollegeCount', topCollege ? topCollege[1] + ' visits' : '');
}

// ── RENDER TABLE ──
function renderTable(docs) {
  const tbody   = document.getElementById('visitorsTableBody');
  const countEl = document.getElementById('tableCount');
  if (!tbody) return;

  if (countEl) countEl.textContent = docs.length + ' record' + (docs.length !== 1 ? 's' : '');

  if (docs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2.5rem;">No visitor records found for this period.</td></tr>';
    return;
  }

  tbody.innerHTML = docs.map((d, i) => {
    const ts = d.timestamp?.toDate?.();
    const dateStr = ts ? ts.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) + ' ' + ts.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' }) : '–';
    const typeBadge = {
      student: '<span class="badge badge-navy">Student</span>',
      faculty: '<span class="badge badge-gold">Faculty</span>',
      staff:   '<span class="badge badge-info">Staff</span>',
      guest:   '<span class="badge badge-gray">Guest</span>',
    }[d.visitorType] || '<span class="badge badge-gray">–</span>';

    const purposeLabel = {
      reading: 'Reading', research: 'Research', computer: 'Computer Use',
      assignments: 'Assignments', borrowing: 'Borrowing', group_study: 'Group Study', other: 'Other'
    }[d.purpose] || d.purpose || '–';

    return `<tr>
      <td class="text-muted text-xs">${i + 1}</td>
      <td><span class="fw-600">${escHtml(d.visitorID || '–')}</span></td>
      <td>${escHtml(purposeLabel)}</td>
      <td><span class="badge badge-gray">${escHtml(d.college || '–')}</span></td>
      <td>${typeBadge}</td>
      <td class="text-sm text-muted">${dateStr}</td>
      <td><button class="btn btn-danger btn-sm" onclick="blockUser('${escHtml(d.visitorID || '')}')">Block</button></td>
    </tr>`;
  }).join('');
}

// ── APPLY FILTERS ──
function applyFilters() {
  const purpose = document.getElementById('filterPurpose')?.value;
  const college = document.getElementById('filterCollege')?.value;
  const type    = document.getElementById('filterType')?.value;

  let filtered = allVisitorDocs;
  if (purpose) filtered = filtered.filter(d => d.purpose === purpose);
  if (college) filtered = filtered.filter(d => d.college === college);
  if (type)    filtered = filtered.filter(d => d.visitorType === type);

  computeAndRenderStats(filtered);
  renderTable(filtered);
}

function clearFilters() {
  ['filterPurpose','filterCollege','filterType'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  computeAndRenderStats(allVisitorDocs);
  renderTable(allVisitorDocs);
}

// ── BLOCK / UNBLOCK USER ──
function blockUser(visitorID) {
  if (!visitorID) return;
  if (!confirm('Block "' + visitorID + '" from the library system?')) return;
  db.collection('blockedUsers').doc(visitorID).set({
    blocked:   true,
    blockedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    alert('User "' + visitorID + '" has been blocked.');
    loadBlockedUsers();
  }).catch(err => alert('Error: ' + err.message));
}

function unblockUser(visitorID) {
  if (!confirm('Unblock "' + visitorID + '"?')) return;
  db.collection('blockedUsers').doc(visitorID).delete()
    .then(() => {
      alert('User "' + visitorID + '" has been unblocked.');
      loadBlockedUsers();
    })
    .catch(err => alert('Error: ' + err.message));
}

function loadBlockedUsers() {
  const tbody = document.getElementById('blockedTableBody');
  if (!tbody) return;
  db.collection('blockedUsers').where('blocked', '==', true).get()
    .then(snap => {
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted" style="padding:2rem;">No blocked users.</td></tr>';
        return;
      }
      tbody.innerHTML = snap.docs.map(d => {
        const ts = d.data().blockedAt?.toDate?.();
        const dateStr = ts ? ts.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : '–';
        return `<tr>
          <td><span class="fw-600">${escHtml(d.id)}</span></td>
          <td class="text-sm text-muted">${dateStr}</td>
          <td><button class="btn btn-outline btn-sm" onclick="unblockUser('${escHtml(d.id)}')">Unblock</button></td>
        </tr>`;
      }).join('');
    });
}

// ── HELPERS ──
function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = 'alert alert-' + type + ' anim-fadein';
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => { el.classList.add('hidden'); }, 6000);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return '?';
  const parts = nameOrEmail.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || '?').substring(0, 2).toUpperCase();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}