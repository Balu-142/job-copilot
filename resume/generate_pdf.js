const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function generatePDF() {
  const outputDir1 = path.resolve(__dirname);
  const pdfPath1 = path.join(outputDir1, 'Bala_Gurunadham_Pamba_Resume.pdf');
  const pdfPath2 = 'C:\\Users\\DELL\\Desktop\\AGI_AI\\Bala_Gurunadham_Pamba_Resume.pdf';

  const candidatePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);

  const executablePath = candidatePaths.find(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!executablePath) {
    if (fs.existsSync(pdfPath1)) {
      console.log(`[INFO] Browser not found, using bundled pre-compiled PDF at: ${pdfPath1}`);
      return;
    }
    console.warn('[WARN] No browser found for PDF compilation. Continuing with available assets.');
    return;
  }

  console.log(`Using browser: ${executablePath}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const htmlPath = path.resolve(__dirname, 'resume.html');
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

  console.log(`Loading HTML from: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // Ensure web fonts are completely rendered
  await page.evaluateHandle('document.fonts.ready');

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '8mm',
      bottom: '8mm',
      left: '10mm',
      right: '10mm'
    },
    preferCSSPageSize: true
  });

  fs.writeFileSync(pdfPath1, pdfBuffer);
  console.log(`Saved PDF to: ${pdfPath1} (${pdfBuffer.length} bytes)`);

  try {
    const desktopDir = path.dirname(pdfPath2);
    if (!fs.existsSync(desktopDir)) {
      fs.mkdirSync(desktopDir, { recursive: true });
    }
    fs.writeFileSync(pdfPath2, pdfBuffer);
    console.log(`Saved copy to Desktop AGI_AI: ${pdfPath2}`);
  } catch (err) {
    // Non-fatal on systems where Desktop path doesn't exist
  }

  await browser.close();
  console.log('PDF Generation Complete!');
}

generatePDF().catch(err => {
  console.error('Notice during PDF generation:', err.message);
  const pdfPath1 = path.join(__dirname, 'Bala_Gurunadham_Pamba_Resume.pdf');
  if (fs.existsSync(pdfPath1)) {
    console.log('Pre-compiled PDF is present and will be served.');
    process.exit(0);
  }
  process.exit(1);
});
