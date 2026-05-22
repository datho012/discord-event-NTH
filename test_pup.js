const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.swordofjustice.com/sea/index.html#/news', { waitUntil: 'networkidle2' });
  
  await page.waitForSelector('.news-list');
  
  const articles = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('.news-list li').forEach(li => {
      const a = li.querySelector('a');
      if (!a) return;
      const title = a.getAttribute('title') || a.querySelector('.news-title')?.innerText?.trim();
      const url = a.href;
      const img = a.querySelector('img')?.src;
      const category = li.querySelector('.tag-blue')?.innerText?.trim() || 'news';
      const date0 = li.querySelector('.date0')?.innerText?.trim() || '';
      const date1 = li.querySelector('.date1')?.innerText?.trim() || '';
      const date = `2026-${date0}-${date1}`;
      
      items.push({ title, url, imageUrl: img, category, date });
    });
    return items;
  });
  
  console.log(articles);
  await browser.close();
}

test().catch(console.error);
