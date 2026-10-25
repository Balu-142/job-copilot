const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getAllAggregatedJobs } = require('./job_scraper');

const app = express();
const PORT = process.env.PORT || 3500;
const HOST = process.env.HOST || '0.0.0.0';

function getNetworkIp() {
  try {
    const interfaces = os.networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(interfaces)) {
      const lower = name.toLowerCase();
      if (lower.includes('virtualbox') || lower.includes('vmware') || lower.includes('wsl') || lower.includes('vethernet')) {
        continue;
      }
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('127.')) {
          if (iface.address.startsWith('192.168.56.')) continue;
          if (lower.includes('wi-fi') || lower.includes('wireless') || lower.includes('wlan') || lower.includes('ethernet')) {
            return iface.address;
          }
          candidates.push(iface.address);
        }
      }
    }
    if (candidates.length > 0) return candidates[0];
  } catch (err) {
    // fallback
  }
  return 'localhost';
}

app.use(cors());
app.use(express.json());

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/resume-files', express.static(path.join(__dirname, '..', 'resume')));

// Explicit root route & health check
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Candidate Profile Definition
const CANDIDATE_PROFILE = {
  fullName: 'Bala Gurunadham Pamba',
  title: 'Senior Flutter Developer / Lead Mobile Engineer',
  email: 'balupamba1@gmail.com',
  phone: '+91 6302125421',
  location: 'Hyderabad, Telangana, India',
  linkedIn: 'https://linkedin.com/in/balu142',
  totalExperience: '3+ Years',
  noticePeriod: 'Immediate / 15 Days (Negotiable)',
  currentCTC: 'Competitive',
  expectedCTC: '₹14,00,000 - ₹18,00,000 INR (Negotiable)',
  openToRelocation: true,
  preferredLocations: ['Hyderabad', 'Bengaluru', 'Remote', 'Pune'],
  resumePdfPath: path.join(__dirname, '..', 'resume', 'Bala_Gurunadham_Pamba_Resume.pdf'),
  desktopPdfPath: 'C:\\Users\\DELL\\Desktop\\AGI_AI\\Bala_Gurunadham_Pamba_Resume.pdf',
  skills: [
    'Flutter', 'Dart', 'Android', 'POS Hardware', 'MQTT Real-Time Sync',
    'Offline-First (SQLite, Isar, Hive)', 'GetX', 'Bloc', 'Provider',
    'Payment Gateways (Razorpay, Cashfree, Payroc, UPI, Tap to Pay)',
    'Google Maps & Background GPS Tracking', 'NestJS', 'React.js',
    'Google Play Store Publishing (10+ Apps)'
  ]
};

// In-memory cache & persistent storage for applications
let cachedJobs = [];
let lastFetchTime = 0;
const DB_FILE = path.join(__dirname, 'applications_db.json');

function loadApplications() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading applications DB:', err.message);
  }
  return [];
}

function saveApplications(apps) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(apps, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing applications DB:', err.message);
  }
}

let applications = loadApplications();

// Route: Get Candidate Profile
app.get('/api/profile', (req, res) => {
  res.json({
    profile: CANDIDATE_PROFILE,
    resumeAvailable: fs.existsSync(CANDIDATE_PROFILE.resumePdfPath)
  });
});

// Route: Download Resume PDF
app.get('/api/resume/download', (req, res) => {
  const file = path.resolve(CANDIDATE_PROFILE.resumePdfPath);
  if (fs.existsSync(file)) {
    res.setHeader('Content-Disposition', 'attachment; filename="Bala_Gurunadham_Pamba_Resume.pdf"');
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(file).pipe(res);
  } else {
    res.status(404).json({ error: 'Resume PDF not found. Please regenerate.' });
  }
});

// Route: View Resume PDF in Browser
app.get('/api/resume/view', (req, res) => {
  const file = path.resolve(CANDIDATE_PROFILE.resumePdfPath);
  if (fs.existsSync(file)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Bala_Gurunadham_Pamba_Resume.pdf"');
    fs.createReadStream(file).pipe(res);
  } else {
    res.status(404).send('Resume PDF not found.');
  }
});

// Background Auto-Scanner (Runs every 2.5 minutes automatically)
setInterval(async () => {
  try {
    console.log('[Auto-Scanner] Scanning for newly posted Flutter jobs in background...');
    const freshListings = await getAllAggregatedJobs();
    const existingIds = new Set(cachedJobs.map(j => j.id));
    let newCount = 0;
    
    freshListings.forEach(j => {
      if (!existingIds.has(j.id)) {
        j.isNew = true;
        newCount++;
      }
    });

    cachedJobs = freshListings;
    lastFetchTime = Date.now();
    if (newCount > 0) {
      console.log(`[Auto-Scanner] ✨ Found ${newCount} fresh new job listings!`);
    }
  } catch (err) {
    console.warn('[Auto-Scanner] Periodic scan warning:', err.message);
  }
}, 2.5 * 60 * 1000);

// Route: Get Aggregated Jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const now = Date.now();
    const forceRefresh = req.query.force === 'true';

    // Refresh if cache expired (2.5 mins) or force requested
    if (!cachedJobs.length || forceRefresh || now - lastFetchTime > 2.5 * 60 * 1000) {
      cachedJobs = await getAllAggregatedJobs();
      lastFetchTime = now;
    }

    // Merge status from applications DB
    const appliedMap = new Map(applications.map(a => [a.jobId, a.status]));
    const enrichedJobs = cachedJobs.map(j => ({
      ...j,
      status: appliedMap.get(j.id) || j.status
    }));

    res.json({
      jobs: enrichedJobs,
      totalCount: enrichedJobs.length,
      lastUpdated: new Date(lastFetchTime).toISOString(),
      autoScannerActive: true
    });
  } catch (err) {
    console.error('Error in /api/jobs:', err);
    res.status(500).json({ error: 'Failed to aggregate jobs', message: err.message });
  }
});

// Route: Request Permission & Prepare Application Preview
app.post('/api/applications/request-permission', (req, res) => {
  const { jobId } = req.body;
  const job = cachedJobs.find(j => j.id === jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Generate personalized cover snippet (tailored for recruiter posts or job board listings)
  const isPost = job.type === 'HIRING_POST';
  const recruiterName = job.author?.name || 'Hiring Team';

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

  const applicationPayload = {
    jobId: job.id,
    type: job.type || 'JOB_LISTING',
    jobTitle: job.title,
    company: job.company,
    platform: job.platform,
    applyUrl: job.applyUrl,
    salary: job.salary || '₹14,00,000 - ₹22,00,000 INR',
    recruiterEmail: job.recruiterEmail || null,
    author: job.author || null,
    candidate: {
      name: CANDIDATE_PROFILE.fullName,
      email: CANDIDATE_PROFILE.email,
      phone: CANDIDATE_PROFILE.phone,
      location: CANDIDATE_PROFILE.location,
      linkedIn: CANDIDATE_PROFILE.linkedIn,
      experienceYears: '3+ Years',
      noticePeriod: CANDIDATE_PROFILE.noticePeriod,
      expectedCTC: CANDIDATE_PROFILE.expectedCTC,
      resumeAttached: 'Bala_Gurunadham_Pamba_Resume.pdf'
    },
    tailoredCoverLetter: coverSnippet,
    permissionRequired: true,
    message: isPost
      ? `Verify details to dispatch direct email application to ${recruiterName} (${job.recruiterEmail}).`
      : 'User permission is required before submitting this application.'
  };

  res.json({ payload: applicationPayload });
});

// Route: Confirm Permission and Execute Application
app.post('/api/applications/confirm-and-apply', (req, res) => {
  const { jobId, customNotes, confirmedBy } = req.body;
  const job = cachedJobs.find(j => j.id === jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const existingIndex = applications.findIndex(a => a.jobId === jobId);
  const applicationRecord = {
    id: `app-${Date.now()}`,
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    platform: job.platform,
    location: job.location,
    applyUrl: job.applyUrl,
    appliedAt: new Date().toISOString(),
    status: 'APPLIED',
    permissionGranted: true,
    confirmedBy: confirmedBy || 'User (Bala Gurunadham Pamba)',
    notes: customNotes || 'Standard application package submitted with updated PDF resume'
  };

  if (existingIndex >= 0) {
    applications[existingIndex] = applicationRecord;
  } else {
    applications.push(applicationRecord);
  }

  saveApplications(applications);

  // Update cached job status
  job.status = 'APPLIED';

  res.json({
    success: true,
    application: applicationRecord,
    directApplyUrl: job.applyUrl,
    message: `Application to ${job.company} for "${job.title}" successfully approved and recorded!`
  });
});

// Route: Batch Apply with Permission
app.post('/api/applications/batch-apply', (req, res) => {
  const { jobIds, confirmedBy } = req.body;

  if (!Array.isArray(jobIds) || !jobIds.length) {
    return res.status(400).json({ error: 'No job IDs provided' });
  }

  const processed = [];

  for (const id of jobIds) {
    const job = cachedJobs.find(j => j.id === id);
    if (!job) continue;

    const record = {
      id: `app-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      platform: job.platform,
      location: job.location,
      applyUrl: job.applyUrl,
      appliedAt: new Date().toISOString(),
      status: 'APPLIED',
      permissionGranted: true,
      confirmedBy: confirmedBy || 'User (Batch Approval)',
      notes: 'Batch approved application with updated PDF resume'
    };

    const idx = applications.findIndex(a => a.jobId === id);
    if (idx >= 0) {
      applications[idx] = record;
    } else {
      applications.push(record);
    }

    job.status = 'APPLIED';
    processed.push(record);
  }

  saveApplications(applications);

  res.json({
    success: true,
    processedCount: processed.length,
    processed,
    message: `Successfully approved and processed ${processed.length} applications with your permission!`
  });
});

// Route: Get Application History
app.get('/api/applications/history', (req, res) => {
  res.json({
    applications: applications.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt)),
    totalApplied: applications.length
  });
});

app.listen(PORT, HOST, () => {
  const networkIp = getNetworkIp();
  console.log(`=======================================================`);
  console.log(` 🚀 Job Hunter & Application Hub is LIVE!`);
  console.log(` 💻 Local PC URL:      http://localhost:${PORT}`);
  console.log(` 📱 Wi-Fi Device URL:  http://${networkIp}:${PORT}`);
  console.log(` 📄 Resume Download:   http://${networkIp}:${PORT}/api/resume/download`);
  console.log(` 👁️  Resume Preview:    http://${networkIp}:${PORT}/api/resume/view`);
  console.log(`=======================================================`);
  console.log(` 🌐 To access from ANY device globally outside your Wi-Fi:`);
  console.log(`    run: npm run share`);
  console.log(`=======================================================`);
});
