let allJobs = [];
let filteredJobs = [];
let currentJobPayload = null;
let autoScanEnabled = true;
let scanCountdownSeconds = 45;
let countdownInterval = null;
let currentFeedTab = 'ALL'; // 'ALL' | 'JOB_LISTING' | 'HIRING_POST'

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  await refreshJobs();
  await fetchApplicationHistory();
  startAutoScanTimer();
});

// Load Profile
async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data.profile) {
      const nameEl = document.querySelector('.user-name');
      const roleEl = document.querySelector('.user-role');
      if (nameEl) nameEl.textContent = data.profile.fullName;
      if (roleEl) roleEl.textContent = `${data.profile.title} (${data.profile.totalExperience})`;
    }
  } catch (err) {
    console.warn('Could not load profile:', err);
  }
}

// Start Auto-Scan Timer & Live Poller
function startAutoScanTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  scanCountdownSeconds = 45;

  countdownInterval = setInterval(async () => {
    if (!autoScanEnabled) return;

    scanCountdownSeconds--;
    const countdownEl = document.getElementById('scanCountdown');
    if (countdownEl) countdownEl.textContent = scanCountdownSeconds;

    if (scanCountdownSeconds <= 0) {
      scanCountdownSeconds = 45;
      await checkFreshJobsSilently();
    }
  }, 1000);
}

// Toggle Auto-Scan (Pause / Resume)
function toggleAutoScan() {
  autoScanEnabled = !autoScanEnabled;
  const pill = document.getElementById('autoScanPill');
  const label = document.getElementById('autoScanLabel');

  if (autoScanEnabled) {
    pill.classList.remove('paused');
    label.innerHTML = `Auto-Scanner: <strong>LIVE</strong> (<span id="scanCountdown">${scanCountdownSeconds}</span>s)`;
    showToast('Auto-Scanner Resumed', 'Continuously monitoring fresh Flutter openings and recruiter posts.');
  } else {
    pill.classList.add('paused');
    label.innerHTML = `Auto-Scanner: <strong>PAUSED</strong>`;
    showToast('Auto-Scanner Paused', 'Background polling suspended.');
  }
}

// Silent Poller for Fresh Inbound Opportunities
async function checkFreshJobsSilently() {
  try {
    const res = await fetch('/api/jobs');
    const data = await res.json();
    const freshJobs = data.jobs || [];

    const existingIds = new Set(allJobs.map(j => j.id));
    const newItems = freshJobs.filter(j => !existingIds.has(j.id));

    if (newItems.length > 0) {
      newItems.forEach(j => j.isFresh = true);
      allJobs = [...newItems, ...allJobs];
      applyFilters();
      updateStats();

      const topItem = newItems[0];
      const isPost = topItem.type === 'HIRING_POST';
      showToast(
        isPost ? `⚡ New Recruiter Post: ${topItem.author?.name || 'Recruiter'}` : `⚡ New Opening: ${topItem.company}`,
        `${topItem.title} (${topItem.matchScore}% ATS Fit)`
      );
    }
  } catch (err) {
    console.warn('Silent scan check failed:', err.message);
  }
}

// Toast Notification System
function showToast(title, message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.innerHTML = `
    <div class="logo-icon" style="width:28px;height:28px;flex-shrink:0;">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
    </div>
    <div>
      <div style="font-weight:700;font-size:0.84rem;color:#60a5fa;">${escapeHtml(title)}</div>
      <div style="font-size:0.75rem;color:#cbd5e1;margin-top:2px;">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// Fetch & Refresh Jobs Feed (Manual Trigger)
async function refreshJobs() {
  const grid = document.getElementById('jobsGrid');
  grid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Scanning active positions & recruiter hiring posts across LinkedIn, Naukri, Indeed, and RemoteOK...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/jobs?force=true');
    const data = await res.json();
    allJobs = data.jobs || [];
    applyFilters();
    updateStats();
    scanCountdownSeconds = 45;
  } catch (err) {
    grid.innerHTML = `
      <div class="loading-state" style="color: #ef4444;">
        <p>Failed to load jobs feed. Please check backend connection.</p>
        <button class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="refreshJobs()">Try Again</button>
      </div>
    `;
  }
}

// Switch Feed Filter Tab (All / Job Listings / Recruiter Posts)
function switchFeedTab(tab) {
  currentFeedTab = tab;

  const tabAll = document.getElementById('tabAllBtn');
  const tabJobs = document.getElementById('tabJobsBtn');
  const tabPosts = document.getElementById('tabPostsBtn');
  const tabApplied = document.getElementById('tabAppliedBtn');
  const jobsView = document.getElementById('jobsView');
  const appliedView = document.getElementById('appliedView');

  // Make sure we are in jobsView
  jobsView.classList.add('active');
  appliedView.classList.remove('active');
  if (tabApplied) tabApplied.classList.remove('active');

  if (tabAll) tabAll.classList.toggle('active', tab === 'ALL');
  if (tabJobs) tabJobs.classList.toggle('active', tab === 'JOB_LISTING');
  if (tabPosts) tabPosts.classList.toggle('active', tab === 'HIRING_POST');

  applyFilters();
}

// Apply All Filters (Search, Recency, Work Model, Platform, Location, Score, Sort)
function applyFilters() {
  const searchInput = document.getElementById('searchInput');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const recencySelect = document.getElementById('recencySelect');
  const recencyVal = recencySelect ? recencySelect.value : 'ALL';

  const salarySelect = document.getElementById('salarySelect');
  const minSalary = salarySelect ? parseFloat(salarySelect.value) : 0;

  const workModelSelect = document.getElementById('workModelSelect');
  const workModel = workModelSelect ? workModelSelect.value : 'ALL';

  const platformSelect = document.getElementById('platformSelect');
  const platform = platformSelect ? platformSelect.value : 'ALL';

  const locationSelect = document.getElementById('locationSelect');
  const location = locationSelect ? locationSelect.value : 'ALL';

  const matchScoreSelect = document.getElementById('matchScoreSelect');
  const minScore = matchScoreSelect ? parseInt(matchScoreSelect.value, 10) : 0;

  const sortSelect = document.getElementById('sortSelect');
  const sortOrder = sortSelect ? sortSelect.value : 'newest';

  filteredJobs = allJobs.filter(item => {
    // 1. Feed Tab Filter (All vs Job Listings vs Recruiter Posts)
    if (currentFeedTab !== 'ALL' && item.type !== currentFeedTab) {
      return false;
    }

    // 2. Keyword Search (searches title, company, recruiter name, post content, location, skills)
    if (search) {
      const textToSearch = [
        item.title,
        item.company,
        item.location,
        item.author?.name || '',
        item.author?.role || '',
        item.postContent || '',
        item.recruiterEmail || '',
        ...(item.matchedSkills || []),
        item.salary || ''
      ].join(' ').toLowerCase();

      if (!textToSearch.includes(search)) return false;
    }

    // 3. Recency / Date Filter (daysAgo)
    if (recencyVal !== 'ALL') {
      const maxDays = parseInt(recencyVal, 10);
      const itemDaysAgo = item.daysAgo !== undefined ? item.daysAgo : 1;
      if (itemDaysAgo > maxDays) return false;
    }

    // 4. Minimum Salary Package Filter (Starts at 6.5 LPA and Up)
    if (minSalary > 0) {
      const itemMinSalary = item.minSalaryLpa !== undefined ? item.minSalaryLpa : 6.5;
      if (itemMinSalary < minSalary) return false;
    }

    // 5. Work Model Filter (Remote, Hybrid, On-site)
    if (workModel !== 'ALL') {
      const itemModel = item.workModel || (item.location.toLowerCase().includes('remote') ? 'Remote' : 'On-site');
      if (itemModel.toLowerCase() !== workModel.toLowerCase()) return false;
    }

    // 6. Platform Filter
    if (platform !== 'ALL') {
      const platLow = platform.toLowerCase();
      if (platLow === 'linkedin') {
        if (!item.platform.toLowerCase().includes('linkedin') || item.type === 'HIRING_POST') return false;
      } else if (platLow === 'linkedin post') {
        if (item.type !== 'HIRING_POST') return false;
      } else {
        if (!item.platform.toLowerCase().includes(platLow)) return false;
      }
    }

    // 7. Location Filter
    if (location !== 'ALL') {
      if (!item.location.toLowerCase().includes(location.toLowerCase())) return false;
    }

    // 8. Match Score Filter
    if (minScore > 0 && (item.matchScore || 0) < minScore) {
      return false;
    }

    return true;
  });

  // Sorting
  if (sortOrder === 'newest') {
    filteredJobs.sort((a, b) => (b.postedTimestamp || 0) - (a.postedTimestamp || 0));
  } else if (sortOrder === 'salary') {
    filteredJobs.sort((a, b) => (b.minSalaryLpa || 0) - (a.minSalaryLpa || 0));
  } else if (sortOrder === 'match') {
    filteredJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }

  renderJobs(filteredJobs);
  updateBadges();
}

// Update Filter Count Badges
function updateBadges() {
  const totalCountEl = document.getElementById('totalMatchesCount');
  const jobsCountEl = document.getElementById('jobsCountBadge');
  const postsCountEl = document.getElementById('postsCountBadge');

  const officialJobs = filteredJobs.filter(j => j.type === 'JOB_LISTING');
  const recruiterPosts = filteredJobs.filter(j => j.type === 'HIRING_POST');

  if (totalCountEl) totalCountEl.textContent = filteredJobs.length;
  if (jobsCountEl) jobsCountEl.textContent = officialJobs.length;
  if (postsCountEl) postsCountEl.textContent = recruiterPosts.length;
}

// Render Job & Recruiter Post Cards
function renderJobs(jobs) {
  const grid = document.getElementById('jobsGrid');
  if (!grid) return;

  if (!jobs.length) {
    grid.innerHTML = `
      <div class="loading-state">
        <p style="font-size:1.05rem;font-weight:600;color:#cbd5e1;margin-bottom:8px;">No matching opportunities found with current filters.</p>
        <p style="font-size:0.84rem;color:#94a3b8;margin-bottom:16px;">Try switching to "All Dates (Past Month)" or resetting your filters to see more listings.</p>
        <button class="btn btn-outline btn-sm" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = jobs.map(job => {
    const isApplied = job.status === 'APPLIED';
    const scoreClass = job.matchScore >= 90 ? 'gold' : '';
    const freshClass = (job.isFresh || job.isNew || job.daysAgo <= 1) ? 'is-fresh' : '';

    // Recency badge formatting
    let recencyBadge = '';
    if (job.daysAgo === 0 || (job.postedTime && job.postedTime.includes('hour'))) {
      recencyBadge = `<span class="recency-chip chip-today">⚡ ${escapeHtml(job.postedTime || 'Today')}</span>`;
    } else if (job.daysAgo <= 3) {
      recencyBadge = `<span class="recency-chip chip-recent">🔥 ${escapeHtml(job.postedTime || `${job.daysAgo}d ago`)}</span>`;
    } else if (job.daysAgo <= 7) {
      recencyBadge = `<span class="recency-chip chip-week">✨ ${escapeHtml(job.postedTime || `${job.daysAgo}d ago`)}</span>`;
    } else {
      recencyBadge = `<span class="recency-chip chip-older">🗓️ ${escapeHtml(job.postedTime || `${job.daysAgo}d ago`)}</span>`;
    }

    // Work model pill
    const workModelBadge = job.workModel ? `<span class="work-model-pill">${escapeHtml(job.workModel)}</span>` : '';

    // ==========================================
    // RENDER: DIRECT RECRUITER / FOUNDER HIRING POST
    // ==========================================
    if (job.type === 'HIRING_POST') {
      const author = job.author || {
        name: 'Tech Recruiter',
        role: 'Talent Acquisition',
        company: job.company,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      };

      return `
        <div class="job-card hiring-post-card ${freshClass}" id="card-${job.id}">
          <div>
            <!-- Recruiter Author Header -->
            <div class="recruiter-header">
              <img class="recruiter-avatar" src="${author.avatar}" alt="${escapeHtml(author.name)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&background=2563eb&color=fff'">
              <div class="recruiter-meta">
                <div class="recruiter-name-row">
                  <span class="recruiter-name">${escapeHtml(author.name)}</span>
                  <svg class="verified-icon" viewBox="0 0 20 20" fill="#38bdf8" title="Verified Professional"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                  <span class="post-type-tag">📢 Recruiter Post</span>
                </div>
                <div class="recruiter-headline">${escapeHtml(author.role)}</div>
              </div>

              <div class="match-score-badge ${scoreClass}" style="margin-left:auto;">
                <svg style="width:13px;height:13px;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                ${job.matchScore}% ATS Fit
              </div>
            </div>

            <!-- Post Title & Badges -->
            <h3 class="job-title" style="margin-top:10px;">${escapeHtml(job.title)}</h3>

            <!-- Prominent High-Value Salary Package Banner (Min 6.5 LPA and Up) -->
            <div class="card-salary-banner">
              <div class="salary-pill-glow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span><strong>Package:</strong> ${escapeHtml(job.salary || '₹10,50,000 - ₹16,50,000 INR (10.5 - 16.5 LPA)')}</span>
              </div>
            </div>

            <div class="job-meta-row" style="margin-bottom:10px;">
              ${recencyBadge}
              ${workModelBadge}
              <span class="job-meta-item">
                <svg style="width:13px;height:13px;color:#94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                ${escapeHtml(job.location)}
              </span>
            </div>

            <!-- Recruiter Post Snippet Box -->
            <div class="post-content-box">
              <div class="post-text-body">
                ${escapeHtml(job.postContent || '')}
              </div>
            </div>

            <!-- Direct Contact Pill -->
            ${job.recruiterEmail ? `
              <div class="recruiter-contact-pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <span>Direct Contact: <strong>${escapeHtml(job.recruiterEmail)}</strong></span>
              </div>
            ` : ''}

            <!-- Skills -->
            <div class="skills-tags" style="margin-top:10px;">
              ${(job.matchedSkills || []).map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
            </div>
          </div>

          <!-- Actions Bar -->
          <div class="job-card-actions">
            ${isApplied ? `
              <span class="applied-badge">
                <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                Application Dispatched
              </span>
              <a href="${job.applyUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" style="margin-left:auto;">
                View Post ↗
              </a>
            ` : `
              <button class="btn btn-sm btn-primary" onclick="openPermissionModal('${job.id}')">
                <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                Send Email &amp; Resume
              </button>
              ${(job.dmRecruiterUrl || author.linkedInUrl) ? `
                <a href="${job.dmRecruiterUrl || author.linkedInUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" title="Connect / Direct Message on LinkedIn">
                  <svg class="btn-icon" fill="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.5 1.5 0 1 0-.01-3.01 1.5 1.5 0 0 0 .01 3.01m1.39 9.74v-8.37H5.07v8.37h2.78z"/></svg>
                  DM Recruiter
                </a>
              ` : ''}
              <a href="${job.applyUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" style="margin-left:auto;">
                View Post ↗
              </a>
            `}
          </div>
        </div>
      `;
    }

    // ==========================================
    // RENDER: STANDARD OFFICIAL JOB BOARD OPENING
    // ==========================================
    return `
      <div class="job-card ${freshClass}" id="card-${job.id}">
        <div>
          <div class="job-top-row">
            <span class="job-platform-pill">
              <img src="${job.platformLogo}" onerror="this.style.display='none'" alt="${job.platform}">
              ${job.platform}
              ${(job.isFresh || job.isNew) ? '<span class="badge-fresh-new">NEW</span>' : ''}
            </span>
            <div class="match-score-badge ${scoreClass}">
              <svg style="width:13px;height:13px;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
              ${job.matchScore}% ATS Fit
            </div>
          </div>

          <h3 class="job-title">${escapeHtml(job.title)}</h3>
          <div class="job-company">${escapeHtml(job.company)}</div>

          <!-- Prominent High-Value Salary Package Banner (Min 6.5 LPA and Up) -->
          <div class="card-salary-banner">
            <div class="salary-pill-glow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Package:</strong> ${escapeHtml(job.salary || '₹12,50,000 - ₹18,50,000 INR (12.5 - 18.5 LPA)')}</span>
            </div>
          </div>

          <div class="job-meta-row">
            ${recencyBadge}
            ${workModelBadge}
            <span class="job-meta-item">
              <svg style="width:13px;height:13px;color:#94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
              ${escapeHtml(job.location)}
            </span>
          </div>

          <div class="skills-tags">
            ${(job.matchedSkills || []).map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>

        <div class="job-card-actions">
          ${isApplied ? `
            <span class="applied-badge">
              <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              Applied with Permission
            </span>
            <a href="${job.applyUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" style="margin-left:auto;">
              View Job ↗
            </a>
          ` : `
            <button class="btn btn-sm btn-primary" onclick="openPermissionModal('${job.id}')">
              <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              Review &amp; Apply
            </button>
            ${job.dmRecruiterUrl ? `
              <a href="${job.dmRecruiterUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" title="Direct Message Recruiter for ${escapeHtml(job.company)} on LinkedIn">
                <svg class="btn-icon" fill="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.5 1.5 0 1 0-.01-3.01 1.5 1.5 0 0 0 .01 3.01m1.39 9.74v-8.37H5.07v8.37h2.78z"/></svg>
                DM Recruiter
              </a>
            ` : ''}
            <a href="${job.applyUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" style="margin-left:auto;">
              View Job ↗
            </a>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// Reset All Filters
function resetFilters() {
  const searchInput = document.getElementById('searchInput');
  const recencySelect = document.getElementById('recencySelect');
  const salarySelect = document.getElementById('salarySelect');
  const workModelSelect = document.getElementById('workModelSelect');
  const platformSelect = document.getElementById('platformSelect');
  const locationSelect = document.getElementById('locationSelect');
  const matchScoreSelect = document.getElementById('matchScoreSelect');
  const sortSelect = document.getElementById('sortSelect');

  if (searchInput) searchInput.value = '';
  if (recencySelect) recencySelect.value = 'ALL';
  if (salarySelect) salarySelect.value = '0';
  if (workModelSelect) workModelSelect.value = 'ALL';
  if (platformSelect) platformSelect.value = 'ALL';
  if (locationSelect) locationSelect.value = 'ALL';
  if (matchScoreSelect) matchScoreSelect.value = '0';
  if (sortSelect) sortSelect.value = 'newest';

  currentFeedTab = 'ALL';
  switchFeedTab('ALL');
}

// Update Top Statistics
function updateStats() {
  const total = allJobs.length;
  const recruiterPosts = allJobs.filter(j => j.type === 'HIRING_POST').length;
  const highMatch = allJobs.filter(j => j.matchScore >= 90).length;
  const avgMatch = total ? Math.round(allJobs.reduce((acc, j) => acc + (j.matchScore || 0), 0) / total) : 0;
  const appliedCount = allJobs.filter(j => j.status === 'APPLIED').length;

  const totalEl = document.getElementById('statTotalJobs');
  const postsEl = document.getElementById('statTotalPosts');
  const highEl = document.getElementById('statHighMatch');
  const avgEl = document.getElementById('statAvgMatch');
  const appEl = document.getElementById('statApplied');

  if (totalEl) totalEl.textContent = total;
  if (postsEl) postsEl.textContent = recruiterPosts;
  if (highEl) highEl.textContent = highMatch;
  if (avgEl) avgEl.textContent = `${avgMatch}%`;
  if (appEl) appEl.textContent = appliedCount;

  updateBadges();
}

// Client-side Fallback Application Payload Generator (guarantees modal never crashes on cold start)
function buildClientApplicationPayload(job) {
  const isPost = job.type === 'HIRING_POST';
  const recruiterName = job.author?.name || 'Hiring Lead';

  const coverSnippet = isPost
    ? `Dear ${recruiterName},

I saw your hiring post regarding the ${job.title} role at ${job.company} and wanted to reach out directly.

With 3+ years of commercial production experience in Flutter & Dart, I have built and scaled enterprise mobile solutions including:
• Full Retail & POS ecosystems with sub-second MQTT synchronization
• Resilient Offline-first local databases (SQLite, Isar, Hive)
• Payment Gateways (Razorpay, Cashfree, Payroc, UPI, Tap to Pay) & Android POS hardware
• Google Maps background GPS tracking & 10+ Play Store published apps

I am available for an immediate start (notice period: 15 days or negotiable) and would welcome the opportunity to discuss how my hands-on mobile experience matches your team's goals. My PDF resume is attached.

Best regards,
Bala Gurunadham Pamba
Phone: +91 6302125421 | Email: balupamba1@gmail.com
LinkedIn: https://linkedin.com/in/balu142`
    : `Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} position. With over 3 years of commercial production experience in Flutter & Dart, I have architected large-scale enterprise mobile applications including full-scale Retail & Restaurant POS ecosystems with sub-second MQTT real-time synchronization, offline-first architectures (SQLite, Isar, Hive), and diverse hardware & payment gateway integrations (Razorpay, Cashfree, Payroc, Tap to Pay).

Having successfully engineered and published 10+ applications to the Google Play Store, I am confident in my ability to immediately add value to your team at ${job.company}.

Sincerely,
Bala Gurunadham Pamba
Hyderabad, India | +91 6302125421 | balupamba1@gmail.com`;

  return {
    jobId: job.id,
    type: job.type || 'JOB_LISTING',
    jobTitle: job.title || 'Senior Flutter Developer',
    company: job.company || 'Enterprise Technology Partner',
    platform: job.platform || 'Direct',
    applyUrl: job.applyUrl || '#',
    salary: job.salary || '₹14,00,000 - ₹22,00,000 INR (14 - 22 LPA)',
    recruiterEmail: job.recruiterEmail || null,
    author: job.author || null,
    candidate: {
      name: 'Bala Gurunadham Pamba',
      email: 'balupamba1@gmail.com',
      phone: '+91 6302125421',
      location: 'Hyderabad, Telangana, India',
      linkedIn: 'https://linkedin.com/in/balu142',
      experienceYears: '3+ Years',
      noticePeriod: 'Immediate / 15 Days',
      expectedCTC: '₹14,00,000 - ₹22,00,000 INR (14 - 22 LPA)',
      resumeAttached: 'Bala_Gurunadham_Pamba_Resume.pdf'
    },
    tailoredCoverLetter: coverSnippet,
    permissionRequired: true
  };
}

// OPEN PERMISSION & AUTHORIZATION MODAL (Resilient to cold starts & network blips)
async function openPermissionModal(jobId) {
  try {
    const localJob = (window.allJobs || allJobs || []).find(j => j.id === jobId) || 
                     (filteredJobs || []).find(j => j.id === jobId);

    let payload = null;

    try {
      const res = await fetch('/api/applications/request-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, job: localJob })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.payload) {
          payload = data.payload;
        }
      }
    } catch (netErr) {
      console.warn('Backend permission fetch failed, utilizing client generator:', netErr);
    }

    if (!payload) {
      if (localJob) {
        payload = buildClientApplicationPayload(localJob);
      } else {
        payload = buildClientApplicationPayload({ id: jobId, title: 'Senior Flutter Developer', company: 'Tech Partner' });
      }
    }

    currentJobPayload = payload;

    const isPost = currentJobPayload.type === 'HIRING_POST';
    const securityBadge = document.querySelector('#permissionModal .security-badge');
    const modalTitle = document.getElementById('modalJobTitle');
    const modalCompany = document.getElementById('modalCompany');
    const alertBox = document.querySelector('#permissionModal .permission-alert');
    const confirmBtn = document.getElementById('btnConfirmPermission');
    const directLink = document.getElementById('modalDirectJobLink');

    if (directLink && currentJobPayload.applyUrl) {
      directLink.href = currentJobPayload.applyUrl;
      directLink.textContent = isPost ? 'Open LinkedIn Post ↗' : 'Open Official Job Listing ↗';
      directLink.style.display = 'inline-flex';
    }

    if (isPost && currentJobPayload.recruiterEmail) {
      if (securityBadge) securityBadge.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:13px;height:13px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        Direct Recruiter Email Application
      `;
      if (modalTitle) modalTitle.textContent = currentJobPayload.jobTitle;
      if (modalCompany) {
        modalCompany.innerHTML = `To Recruiter: ${escapeHtml(currentJobPayload.author?.name || 'Hiring Lead')} (${escapeHtml(currentJobPayload.recruiterEmail)}) • ${escapeHtml(currentJobPayload.company)} &nbsp;|&nbsp; <span style="color:#34d399;font-weight:700;">💰 ${escapeHtml(currentJobPayload.salary || '₹10.5 - ₹16.5 LPA')}</span>`;
      }
      if (alertBox) alertBox.innerHTML = `
        You are authorizing a direct candidate application email to <strong>${escapeHtml(currentJobPayload.recruiterEmail)}</strong>. Your <strong>Bala_Gurunadham_Pamba_Resume.pdf</strong> and full contact details will be dispatched upon your confirmation.
      `;
      if (confirmBtn) confirmBtn.innerHTML = `
        <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        Authorize &amp; Send Application Email
      `;
    } else {
      if (securityBadge) securityBadge.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:13px;height:13px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        Permission Gate Active
      `;
      if (modalTitle) modalTitle.textContent = currentJobPayload.jobTitle;
      if (modalCompany) {
        modalCompany.innerHTML = `${escapeHtml(currentJobPayload.company)} • ${escapeHtml(currentJobPayload.platform)} &nbsp;|&nbsp; <span style="color:#34d399;font-weight:700;">💰 ${escapeHtml(currentJobPayload.salary || '₹14 - ₹22 LPA')}</span>`;
      }
      if (alertBox) alertBox.innerHTML = `
        This application will NOT be submitted until you review and grant permission. Click "Grant Permission &amp; Apply" to record your application with tailored cover introduction and open the official listing.
      `;
      if (confirmBtn) confirmBtn.innerHTML = `
        <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        Grant Permission &amp; Apply
      `;
    }

    document.getElementById('mCoverLetter').value = currentJobPayload.tailoredCoverLetter;
    document.getElementById('permissionModal').classList.add('open');
  } catch (err) {
    console.error('Error opening permission modal:', err);
    showToast('Notice', 'Unable to open application preview: ' + err.message);
  }
}

function closePermissionModal() {
  document.getElementById('permissionModal').classList.remove('open');
  currentJobPayload = null;
}

// EXECUTE APPLICATION WITH USER AUTHORIZATION (Guaranteed Redirection Without Popup Blocker Issues)
async function executePermissionAndApply() {
  if (!currentJobPayload) return;

  const targetApplyUrl = currentJobPayload.applyUrl;
  const isPost = currentJobPayload.type === 'HIRING_POST';
  const customNotes = document.getElementById('mCoverLetter').value;
  const noticeVal = document.getElementById('mNotice').value;
  const expCTCVal = document.getElementById('mExpectedCTC').value;
  const recruiterEmail = currentJobPayload.recruiterEmail;

  // Open the official listing immediately in user click context so browser popup blockers will NOT intercept it
  let preOpenedWindow = null;
  if (!isPost && targetApplyUrl && targetApplyUrl.startsWith('http')) {
    preOpenedWindow = window.open(targetApplyUrl, '_blank');
  }

  try {
    const res = await fetch('/api/applications/confirm-and-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: currentJobPayload.jobId,
        job: currentJobPayload,
        customNotes,
        confirmedBy: 'User (Explicit Confirmation)',
        noticePeriod: noticeVal,
        expectedCTC: expCTCVal
      })
    });
    const result = await res.json();

    if (result.success) {
      const targetJob = allJobs.find(j => j.id === currentJobPayload.jobId);
      if (targetJob) targetJob.status = 'APPLIED';

      closePermissionModal();
      applyFilters();
      updateStats();
      await fetchApplicationHistory();

      showToast(
        isPost ? 'Direct Application Dispatched' : 'Application Authorization Granted',
        `Applied to ${currentJobPayload.jobTitle} at ${currentJobPayload.company}.`
      );

      // Handle recruiter email dispatch
      if (isPost && recruiterEmail) {
        const mailSubject = encodeURIComponent(`Application for ${currentJobPayload.jobTitle} - Bala Gurunadham Pamba`);
        const mailBody = encodeURIComponent(customNotes);
        window.location.href = `mailto:${recruiterEmail}?subject=${mailSubject}&body=${mailBody}`;
      } else if (isPost && targetApplyUrl && targetApplyUrl.startsWith('http')) {
        window.open(targetApplyUrl, '_blank');
      }
    }
  } catch (err) {
    alert('Error applying: ' + err.message);
  }
}

// BATCH APPROVAL MODAL
function openBatchApprovalModal() {
  const candidates = filteredJobs.filter(j => j.status !== 'APPLIED' && j.matchScore >= 80);
  const container = document.getElementById('batchListItems');
  const countSpan = document.getElementById('batchJobCount');

  if (!candidates.length) {
    alert('No unapplied jobs with match score >= 80% found under current filters.');
    return;
  }

  countSpan.textContent = candidates.length;
  container.innerHTML = candidates.map(j => `
    <div class="batch-job-row">
      <div>
        <strong>${escapeHtml(j.title)}</strong>
        <div style="font-size:0.75rem;color:#60a5fa;">${escapeHtml(j.company)} • ${escapeHtml(j.platform)}</div>
      </div>
      <div style="text-align:right;">
        <span class="match-score-badge ${j.matchScore >= 90 ? 'gold' : ''}" style="display:inline-flex;">${j.matchScore}%</span>
      </div>
    </div>
  `).join('');

  document.getElementById('batchModal').classList.add('open');
}

function closeBatchModal() {
  document.getElementById('batchModal').classList.remove('open');
}

async function executeBatchApply() {
  const candidates = filteredJobs.filter(j => j.status !== 'APPLIED' && j.matchScore >= 80);
  const jobIds = candidates.map(j => j.id);

  try {
    const res = await fetch('/api/applications/batch-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds, confirmedBy: 'User (Batch Authorization)' })
    });
    const data = await res.json();

    if (data.success) {
      candidates.forEach(j => j.status = 'APPLIED');
      closeBatchModal();
      applyFilters();
      updateStats();
      await fetchApplicationHistory();

      showToast('Batch Authorization Complete', `Successfully approved ${data.processedCount} applications.`);
    }
  } catch (err) {
    alert('Error during batch execution: ' + err.message);
  }
}

// APPLICATION TRACKER
async function fetchApplicationHistory() {
  try {
    const res = await fetch('/api/applications/history');
    const data = await res.json();
    const apps = data.applications || [];
    const countBadge = document.getElementById('appliedCountBadge');
    if (countBadge) countBadge.textContent = apps.length;

    const tbody = document.getElementById('trackerTableBody');
    if (!tbody) return;

    if (!apps.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted" style="text-align:center;padding:30px;">
            No applications recorded yet. Review matches and grant permission to apply.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = apps.map(app => `
      <tr>
        <td>
          <strong>${escapeHtml(app.jobTitle)}</strong>
          <div style="font-size:0.75rem;color:#60a5fa;">${escapeHtml(app.company)}</div>
        </td>
        <td><span class="job-platform-pill">${escapeHtml(app.platform)}</span></td>
        <td>${escapeHtml(app.location || 'N/A')}</td>
        <td style="font-size:0.75rem;color:#94a3b8;">${new Date(app.appliedAt).toLocaleString()}</td>
        <td>
          <span class="applied-badge" style="padding:3px 8px;font-size:0.72rem;">
            Granted by ${escapeHtml(app.confirmedBy || 'User')}
          </span>
        </td>
        <td>
          <a href="${app.applyUrl}" target="_blank" class="btn btn-sm btn-ghost">
            View Job
          </a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn('Error fetching application history:', err);
  }
}

// Tab Switching (Opportunities View vs Tracker View)
function switchTab(viewName) {
  const allBtn = document.getElementById('tabAllBtn');
  const jobsBtn = document.getElementById('tabJobsBtn');
  const postsBtn = document.getElementById('tabPostsBtn');
  const appliedBtn = document.getElementById('tabAppliedBtn');
  const jobsView = document.getElementById('jobsView');
  const appliedView = document.getElementById('appliedView');

  if (viewName === 'applied') {
    if (allBtn) allBtn.classList.remove('active');
    if (jobsBtn) jobsBtn.classList.remove('active');
    if (postsBtn) postsBtn.classList.remove('active');
    if (appliedBtn) appliedBtn.classList.add('active');

    jobsView.classList.remove('active');
    appliedView.classList.add('active');
    fetchApplicationHistory();
  } else {
    switchFeedTab('ALL');
  }
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
