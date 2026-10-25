const cheerio = require('cheerio');

async function fetchLinkedInJobs(keyword, location, start = 0) {
  try {
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&f_TPR=r2592000&start=${start}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const jobs = [];

    $('li').each((_, el) => {
      const card = $(el).find('.job-search-card');
      if (!card.length) return;

      const title = $(el).find('.base-search-card__title').text().trim();
      const company = $(el).find('.base-search-card__subtitle a').text().trim() || $(el).find('.base-search-card__subtitle').text().trim();
      const jobLoc = $(el).find('.job-search-card__location').text().trim();
      const link = $(el).find('a.base-card__full-link').attr('href') || $(el).find('a').first().attr('href');
      const time = $(el).find('time').text().trim() || 'Recently';
      const cleanLink = link ? link.split('?')[0] : '';

      if (title && company && cleanLink) {
        jobs.push({ title, company, jobLoc, cleanLink, time });
      }
    });

    return jobs;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function run() {
  const [j1, j2, j3, j4] = await Promise.all([
    fetchLinkedInJobs('Flutter Developer', 'Hyderabad', 0),
    fetchLinkedInJobs('Flutter Developer', 'Hyderabad', 25),
    fetchLinkedInJobs('Senior Flutter Developer', 'Hyderabad', 0),
    fetchLinkedInJobs('Flutter Developer', 'Bengaluru', 0)
  ]);

  const all = [...j1, ...j2, ...j3, ...j4];
  console.log('Total real scraped jobs:', all.length);
  const seen = new Set();
  const unique = all.filter(j => {
    const k = j.title + '_' + j.company;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  console.log('Unique real scraped jobs:', unique.length);
  unique.slice(0, 10).forEach((j, i) => {
    console.log(`${i+1}. [${j.company}] ${j.title}`);
    console.log(`   URL: ${j.cleanLink}`);
    console.log(`   Time: ${j.time}`);
  });
}

run();
