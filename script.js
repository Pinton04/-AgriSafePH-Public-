// Supabase config (use the global injected by the CDN)
const supabaseUrl = 'https://cpnklwbreaioxkzwyxum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbmtsd2JyZWFpb3hrend5eHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0MzczMjMsImV4cCI6MjA2NDAxMzMyM30.kag5ELIX7IzLU0cOlPyuVRyuP6swgcEMMRfoMbIPbGU';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
  // REGISTER PAGE
  const regForm = document.getElementById('registerForm');
  if (regForm) {
    regForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      const { error } = await supabase.auth.signUp({ email, password });
      document.getElementById('registerMessage').innerText = error
        ? error.message
        : '✅ Registered! Check your email to confirm.';
    });
  }

  // LOGIN PAGE
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      const msgEl = document.getElementById('loginMessage');
      msgEl.innerText = error
        ? error.message
        : '✅ Login successful. Redirecting...';
      if (!error) setTimeout(() => location.href = 'dashboard.html', 800);
    });
  }

  // PUBLIC REPORT PAGE
  const publicForm = document.getElementById('publicReportForm');
  if (publicForm) {
    publicForm.addEventListener('submit', async e => {
      e.preventDefault();
      const type = document.getElementById('type').value;
      const location = document.getElementById('location').value;
      const severity = document.getElementById('severity').value;
      const description = document.getElementById('description').value;
      const { error } = await supabase.from('incidents').insert([{
        type, location, severity, description, status: 'pending'
      }]);
      const msgEl = document.getElementById('publicReportMessage');
      msgEl.innerText = error
        ? '❌ Failed to submit. Please try again.'
        : '✅ Thank you! Your report has been submitted.';
      if (!error) publicForm.reset();
    });
  }

  // DASHBOARD PAGE
  const dashboardContainer = document.querySelector('.dashboard-container');
  if (dashboardContainer) {
    checkSession();            // redirect if not logged in
    loadIncidentsForAdmin();   // initial fetch

    // real-time subscription for new incidents
supabase
  .channel('incident-updates')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'incidents'
  }, ({ new: inc }) => {
    appendIncidentRow(inc);
  })
  .subscribe();

  }
});

// LOGOUT (available on dashboard)
function logout() {
  supabase.auth.signOut()
    .then(() => location.href = 'index.html');
}

// PROTECT DASHBOARD
async function checkSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    alert('Please log in first.');
    location.href = 'index.html';
  } else {
    const el = document.getElementById('authStatus');
    if (el) el.innerText = `Logged in as ${data.session.user.email}`;
  }
}

// DASHBOARD HELPERS

// fetch & render all incidents
async function loadIncidentsForAdmin() {
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false });
  const container = document.getElementById('incidentList');
  if (!container) return;
  container.innerHTML = '';
  if (error) {
    container.innerText = '❌ Failed to load incidents.';
    return;
  }
  incidents.forEach(appendIncidentCard);
}

function appendIncidentRow(inc) {
  const tbody = document.querySelector('#incidentTable tbody');
  if (!tbody) return;

  // Avoid duplicates
  if (document.getElementById(`incident-row-${inc.id}`)) return;

  const row = document.createElement('tr');
  row.id = `incident-row-${inc.id}`;
  row.innerHTML = `
    <td>${inc.type}</td>
    <td>${inc.location}</td>
    <td>${inc.severity}</td>
    <td title="${inc.description}">${inc.description.length > 50 ? inc.description.slice(0, 50) + '...' : inc.description}</td>
    <td>
      ${inc.image ? `<img src="${inc.image}" alt="Incident Image" width="60" style="border-radius: 4px;" />` : 'No image'}
    </td>
    <td>
      <select id="status-${inc.id}">
        <option value="pending" ${inc.status === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="investigating" ${inc.status === 'investigating' ? 'selected' : ''}>Investigating</option>
        <option value="resolved" ${inc.status === 'resolved' ? 'selected' : ''}>Resolved</option>
      </select>
    </td>
    <td>
      <textarea id="comment-${inc.id}" rows="5" style="width: 100%;">${inc.admin_comment || ''}</textarea>
    </td>
    <td>
      <button onclick="submitResponse('${inc.id}')">Save</button>
      <button onclick="deleteIncident('${inc.id}')" style="margin-left:8px; color: white; background-color: #e74c3c; border: none; padding: 5px 10px; cursor: pointer;">Delete</button>
    </td>
  `;

  tbody.prepend(row);
}


// fetch & render all incidents in table format
async function loadIncidentsForAdmin() {
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false });

  const tbody = document.querySelector('#incidentTable tbody');
  if (!tbody) return;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7">❌ Failed to load incidents.</td></tr>`;
    return;
  }

  tbody.innerHTML = ''; // clear current rows
  incidents.forEach(appendIncidentRow);
}

// update status & comment
async function submitResponse(incidentId) {
  const status = document.getElementById(`status-${incidentId}`).value;
  const comment = document.getElementById(`comment-${incidentId}`).value;
  const { error } = await supabase
    .from('incidents')
    .update({ status, admin_comment: comment })
    .eq('id', incidentId);
  if (error) {
    alert('❌ Failed to update: ' + error.message);
  } else {
    alert('✅ Update saved.');
  }
}

// SHOW/HIDE PASSWORD (for login/register)
function togglePassword(inputId, icon) {
  const fld = document.getElementById(inputId);
  if (fld) {
    if (fld.type === 'password') {
      fld.type = 'text';
      icon.textContent = '🙈';
    } else {
      fld.type = 'password';
      icon.textContent = '👁️';
    }
  }
}
async function deleteIncident(incidentId) {
  if (!confirm('Are you sure you want to delete this incident?')) return;

  const { error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', incidentId);

  if (error) {
    alert('❌ Failed to delete: ' + error.message);
  } else {
    // Remove the row from the table
    const row = document.getElementById(`incident-row-${incidentId}`);
    if (row) row.remove();
    alert('✅ Incident deleted.');
  }
}
/* Set the width of the sidebar to 250px (show it) */
function openNav() {
  document.getElementById("mySidepanel").style.width = "250px";
}

/* Set the width of the sidebar to 0 (hide it) */
function closeNav() {
  document.getElementById("mySidepanel").style.width = "0";
}