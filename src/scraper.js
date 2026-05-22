const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { translate } = require('@vitalets/google-translate-api');

async function scrapeSwordOfJustice(page) {
    await page.goto('https://www.swordofjustice.com/sea/index.html#/news', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('.news-list', { timeout: 15000 });
    
    return await page.evaluate(() => {
      const items = [];
      const currentYear = new Date().getFullYear();
      
      document.querySelectorAll('.news-list li').forEach(li => {
        const a = li.querySelector('a');
        if (!a) return;
        
        const title = a.getAttribute('title') || a.querySelector('.news-title')?.innerText?.trim() || '';
        const url = a.href;
        const img = a.querySelector('img')?.src || '';
        const category = li.querySelector('.tag-blue')?.innerText?.trim() || 'news';
        
        const date0 = li.querySelector('.date0')?.innerText?.trim() || '';
        const date1 = li.querySelector('.date1')?.innerText?.trim() || '';
        const date = `${currentYear}-${date0}-${date1}`;
        
        items.push({
          title,
          description: '',
          url,
          imageUrl: img,
          category,
          date,
          game: 'Sword of Justice'
        });
      });
      return items;
    });
}

async function scrapeNghichThuyHan(page) {
    await page.goto('https://nghichthuyhan.vnggames.com/news/danh-sach.1.html', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('ul', { timeout: 15000 });
    
    return await page.evaluate(() => {
      const items = [];
      
      document.querySelectorAll('ul li').forEach(li => {
        const a = li.querySelector('a');
        if (!a) return;
        
        const title = a.getAttribute('title') || a.querySelector('.news-title')?.innerText?.trim() || '';
        let url = a.href;
        if (url && url.startsWith('//')) {
          url = 'https:' + url;
        }
        
        const img = a.querySelector('.img-container img')?.src || '';
        const category = li.querySelector('.news-cate .text')?.innerText?.trim() || 'Tin Tức';
        
        const timeText = li.querySelector('.news-cate .time')?.innerText?.trim() || '';
        let date = '';
        if (timeText) {
          // format: DD/MM/YYYY
          const parts = timeText.split('/');
          if (parts.length === 3) {
            date = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        
        if (date) {
            items.push({
              title,
              description: '',
              url,
              imageUrl: img,
              category,
              date,
              game: 'Nghịch Thủy Hàn'
            });
        }
      });
      return items;
    });
}

/**
 * Fetches and parses news from both games
 */
async function fetchNews() {
  let browser;
  try {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    
    let executablePath = null;
    if (isProduction) {
      executablePath = await chromium.executablePath();
    } else {
      executablePath = process.platform === 'win32' 
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' 
        : process.platform === 'linux' 
          ? '/usr/bin/google-chrome' 
          : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }

    browser = await puppeteer.launch({
      args: isProduction ? chromium.args : [],
      defaultViewport: isProduction ? chromium.defaultViewport : null,
      executablePath: executablePath,
      headless: isProduction ? chromium.headless : true,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const extractedArticles = [];
    
    // Scrape Sword of Justice
    try {
        const sojArticles = await scrapeSwordOfJustice(page);
        extractedArticles.push(...sojArticles);
    } catch (e) {
        console.error('[Scraper Error]: Sword of Justice failed', e.message);
    }
    
    // Scrape Nghich Thuy Han
    try {
        const nthArticles = await scrapeNghichThuyHan(page);
        extractedArticles.push(...nthArticles);
    } catch (e) {
        console.error('[Scraper Error]: Nghich Thuy Han failed', e.message);
    }

    await browser.close();

    // Group to get the latest event for each day, per game
    const dailyEvents = {};
    for (const article of extractedArticles) {
      if (article.date && article.date.includes('-')) {
        const key = `${article.date}_${article.game}`;
        if (!dailyEvents[key]) {
          dailyEvents[key] = article;
        }
      }
    }

    let filteredArticles = Object.values(dailyEvents);
    filteredArticles.sort((a, b) => b.date.localeCompare(a.date));
    
    // Take the events from the 5 most recent days
    const uniqueDates = [...new Set(filteredArticles.map(a => a.date))];
    uniqueDates.sort((a, b) => b.localeCompare(a));
    const top5Dates = uniqueDates.slice(0, 5);
    
    filteredArticles = filteredArticles.filter(a => top5Dates.includes(a.date));
    filteredArticles.sort((a, b) => a.date.localeCompare(b.date));

    // Translate to Vietnamese (only for Sword of Justice)
    for (const article of filteredArticles) {
      if (article.game === 'Sword of Justice') {
          try {
            const translatedTitle = await translate(article.title, { to: 'vi' });
            article.title = translatedTitle.text;
            
            if (article.category.toLowerCase().includes('announcement')) {
              article.category = 'Thông báo';
            } else {
              article.category = 'Tin tức';
            }
          } catch (err) {
            console.error('[Translation Error]:', err.message);
          }
      }
    }

    return filteredArticles;
  } catch (error) {
    if (browser) await browser.close();
    console.error('[Scraper Error]: Failed to fetch news:', error.message);
    throw error;
  }
}

module.exports = {
  fetchNews
};
