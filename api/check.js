const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { fetchNews } = require('../src/scraper');

module.exports = async (req, res) => {
  // Allow Vercel Cron to trigger this endpoint
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, error: 'Chưa xác thực (Unauthorized)' });
  }

  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Thiếu cấu hình DISCORD_TOKEN hoặc DISCORD_CHANNEL_ID trong biến môi trường.' 
    });
  }

  // Initialize client with gateway intents
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    // Wait for the client to log in successfully
    await new Promise((resolve, reject) => {
      client.once('ready', resolve);
      client.login(token).catch(reject);
    });

    console.log(`[Vercel Serverless] Đăng nhập thành công bot: ${client.user.tag}`);

    const channel = await client.channels.fetch(channelId).catch(err => {
      console.error(`[Vercel Serverless Error] Không tìm thấy kênh ${channelId}:`, err.message);
      return null;
    });

    if (!channel) {
      client.destroy();
      return res.status(404).json({ success: false, error: `Không tìm thấy kênh văn bản với ID: ${channelId}` });
    }

    // Fetch the last 50 messages from the channel to see which URLs have already been announced
    const messages = await channel.messages.fetch({ limit: 50 });
    const sentUrls = [];
    messages.forEach(msg => {
      if (msg.embeds && msg.embeds.length > 0) {
        msg.embeds.forEach(embed => {
          if (embed.url) {
            sentUrls.push(embed.url);
          }
        });
      }
    });

    console.log(`[Vercel Serverless] Đã quét lịch sử kênh: Tìm thấy ${sentUrls.length} liên kết tin tức đã gửi.`);

    // Fetch latest news from website
    const articles = await fetchNews();

    // Filter out articles that have already been sent
    const newArticles = articles.filter(art => !sentUrls.includes(art.url));
    console.log(`[Vercel Serverless] Tin tức tổng cộng: ${articles.length} bài. Bài viết mới: ${newArticles.length}`);

    if (newArticles.length > 0) {
      const embedColor = '#E5C158';
      for (const article of newArticles) {
        const embed = new EmbedBuilder()
          .setTitle(article.title)
          .setURL(article.url)
          .setDescription(article.description || 'Không có mô tả chi tiết.')
          .setColor(embedColor)
          .addFields(
            { name: 'Phân loại', value: `📁 ${article.category.toUpperCase()}`, inline: true },
            { name: 'Ngày đăng', value: `📅 ${article.date}`, inline: true }
          )
          .setTimestamp(new Date());

        if (article.game === 'Sword of Justice') {
          embed.setFooter({ 
            text: 'Sword of Justice - Tin tức & Sự kiện', 
            iconURL: 'https://r.res.easebar.com/pic/20260507/4938db60-811d-429a-8a40-5baa71a49890.png' 
          });
        } else {
          embed.setFooter({ 
            text: 'Nghịch Thủy Hàn - Tin tức & Sự kiện',
            iconURL: 'https://img.zing.vn/products/gnmobi/skin-2014/images/404-1.png'
          });
        }

        if (article.imageUrl) {
          embed.setImage(article.imageUrl);
        }

        await channel.send({ embeds: [embed] }).catch(err => {
          console.error(`[Vercel Serverless Error] Không thể gửi tin nhắn:`, err.message);
        });
      }
      console.log(`[Vercel Serverless] Đã gửi ${newArticles.length} bài viết mới.`);
    }

    // Destroy client connection to exit cleanly
    client.destroy();

    return res.status(200).json({ 
      success: true, 
      message: 'Kiểm tra và gửi tin tức thành công.', 
      totalArticles: articles.length, 
      postedArticles: newArticles.length 
    });

  } catch (error) {
    console.error('[Vercel Serverless Critical Error]:', error.message);
    if (client) client.destroy();
    return res.status(500).json({ success: false, error: error.message });
  }
};
