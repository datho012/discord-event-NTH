const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  PermissionFlagsBits 
} = require('discord.js');
const cron = require('node-cron');
const { fetchNews } = require('./scraper');
const { loadConfig, saveConfig, loadSentArticles, saveSentArticles } = require('./database');

// Configuration loading
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const defaultChannelId = process.env.DISCORD_CHANNEL_ID;
const checkIntervalHours = parseFloat(process.env.CHECK_INTERVAL_HOURS || '24');

if (!token || !clientId || !guildId) {
  console.error('[Lỗi] Thiếu các biến môi trường bắt buộc: DISCORD_TOKEN, DISCORD_CLIENT_ID, hoặc DISCORD_GUILD_ID');
  process.exit(1);
}

// Initialize Bot Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Bot state variables
let lastCheckTime = null;
let activeCronJob = null;

/**
 * Gets the channel where announcements should be posted.
 * Returns either the dynamically configured channel or the default channel from environment variables.
 * @returns {string|null}
 */
function getAnnouncementChannelId() {
  const dynamicConfig = loadConfig();
  if (dynamicConfig.channelId) {
    return dynamicConfig.channelId;
  }
  if (defaultChannelId) {
    return defaultChannelId;
  }
  return null;
}

/**
 * Creates a Discord Embed for a given article.
 * @param {{title: string, description: string, url: string, imageUrl: string, category: string, date: string}} article 
 * @returns {EmbedBuilder}
 */
function createArticleEmbed(article) {
  // Theme color: Gold/yellow for Sword of Justice logo and aesthetics (#E5C158)
  const embedColor = '#E5C158';

  const embed = new EmbedBuilder()
    .setTitle(article.title)
    .setURL(article.url)
    .setDescription(article.description || 'Không có mô tả chi tiết.')
    .setColor(embedColor)
    .addFields(
      { name: 'Phân loại', value: `📁 ${article.category.toUpperCase()}`, inline: true },
      { name: 'Ngày đăng', value: `📅 ${article.date}`, inline: true }
    )
    .setTimestamp(new Date())
    .setFooter({ 
      text: 'Sword of Justice - Tin tức & Sự kiện NTH', 
      iconURL: 'https://r.res.easebar.com/pic/20260507/4938db60-811d-429a-8a40-5baa71a49890.png' 
    });

  if (article.imageUrl) {
    embed.setImage(article.imageUrl);
  }

  return embed;
}

/**
 * Performs a check of the website and posts new articles to the configured channel.
 * @param {boolean} forceCheck If true, runs check even if channel not configured (will log warning)
 * @returns {Promise<{checked: number, posted: number}>}
 */
async function checkAndAnnounceNews(forceCheck = false) {
  lastCheckTime = new Date();
  console.log(`[${lastCheckTime.toLocaleString()}] Đang kiểm tra tin tức & sự kiện mới...`);

  const channelId = getAnnouncementChannelId();
  if (!channelId) {
    console.warn('\n⚠️ [Cảnh báo] Chưa cấu hình kênh gửi thông báo.');
    console.warn('Vui lòng thêm DISCORD_CHANNEL_ID vào file .env hoặc sử dụng lệnh Slash /setsyncchannel trong Discord.');
    if (!forceCheck) return { checked: 0, posted: 0 };
  }

  try {
    const articles = await fetchNews();
    const sentUrls = loadSentArticles();
    
    // Filter out articles that have already been sent
    const newArticles = articles.filter(art => !sentUrls.includes(art.url));
    console.log(`[Scraper] Tìm thấy tổng cộng: ${articles.length} bài viết. Số bài viết mới: ${newArticles.length}`);

    if (newArticles.length === 0) {
      return { checked: articles.length, posted: 0 };
    }

    // If channel is configured, send the new articles
    if (channelId) {
      const channel = await client.channels.fetch(channelId).catch(err => {
        console.error(`[Lỗi] Không thể truy cập kênh ${channelId}:`, err.message);
        return null;
      });

      if (!channel) {
        console.error(`[Lỗi] Không tìm thấy kênh ${channelId} hoặc bot không có quyền truy cập kênh này.`);
        return { checked: articles.length, posted: 0 };
      }

      for (const article of newArticles) {
        const embed = createArticleEmbed(article);
        await channel.send({ embeds: [embed] }).catch(err => {
          console.error(`[Lỗi] Không thể gửi tin nhắn đến kênh ${channelId}:`, err.message);
        });
        
        // Save sent article
        sentUrls.push(article.url);
      }
      
      saveSentArticles(sentUrls);
      console.log(`[Thông báo] Đã gửi thành công ${newArticles.length} bài đăng mới vào kênh.`);
    }

    return { checked: articles.length, posted: newArticles.length };
  } catch (error) {
    console.error('[Lỗi] Lỗi xảy ra khi kiểm tra hoặc thông báo tin tức:', error.message);
    throw error;
  }
}

/**
 * Register Slash Commands in the target Guild
 */
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('setsyncchannel')
      .setDescription('Đặt kênh văn bản nhận thông báo sự kiện / tin tức mới')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addChannelOption(option => 
        option.setName('channel')
          .setDescription('Kênh văn bản muốn nhận tin tức')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('checknews')
      .setDescription('Kiểm tra thủ công tin tức mới từ trang chủ và thông báo ngay lập tức'),
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Xem trạng thái hoạt động của bot tin tức')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('[Slash Commands] Đang cập nhật danh sách lệnh trong Máy chủ...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('[Slash Commands] Cập nhật danh sách lệnh thành công!');
  } catch (error) {
    if (error.code === 50001) {
      console.warn('\n⚠️ [Lưu ý] Bot thiếu quyền đăng ký lệnh Slash (Missing Access).');
      console.warn('Lý do: Khi mời Bot vào máy chủ, bạn chưa bật quyền "applications.commands".');
      console.warn('Cách khắc phục: Mời lại Bot bằng link dưới đây và tích chọn cả "bot" và "applications.commands":');
      console.warn(`👉 Link mời: https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=274877910016&scope=bot%20applications.commands\n`);
      console.warn('Gợi ý: Bot vẫn hoạt động bình thường, bạn có thể tự cấu hình ID kênh trực tiếp trong file `.env` bằng biến `DISCORD_CHANNEL_ID`.');
    } else {
      console.error('[Slash Commands Error] Không thể đăng ký lệnh:', error.message);
    }
  }
}

// Bot startup handlers
client.once('clientReady', async () => {
  console.log(`[Bot] Đã đăng nhập thành công với tên: ${client.user.tag}!`);
  
  // Register slash commands for the specified guild
  await registerSlashCommands();

  // Setup cron job for checking news
  setupScheduler();

  // Perform an initial check on startup
  console.log('[Startup] Thực hiện kiểm tra tin tức lần đầu khi khởi động...');
  checkAndAnnounceNews().catch(err => console.error('[Startup Error] Lỗi kiểm tra tin tức lần đầu:', err.message));
});

/**
 * Dynamically setups the cron job scheduler based on the CHECK_INTERVAL_HOURS environment variable.
 */
function setupScheduler() {
  if (activeCronJob) {
    activeCronJob.stop();
  }

  let cronExpression = '0 0 * * *'; // Default once a day at midnight
  
  if (checkIntervalHours > 0 && checkIntervalHours <= 23 && Number.isInteger(checkIntervalHours)) {
    cronExpression = `0 */${checkIntervalHours} * * *`;
    console.log(`[Scheduler] Đã cài đặt lịch kiểm tra: Mỗi ${checkIntervalHours} giờ một lần (Cron: "${cronExpression}")`);
  } else if (checkIntervalHours === 24) {
    cronExpression = '0 0 * * *';
    console.log(`[Scheduler] Đã cài đặt lịch kiểm tra: Mỗi 24 giờ một lần vào nửa đêm (Cron: "${cronExpression}")`);
  } else {
    // If it's an arbitrary decimal value, fall back to setInterval
    const intervalMs = checkIntervalHours * 60 * 60 * 1000;
    console.log(`[Scheduler] Đã cài đặt lịch kiểm tra: Mỗi ${checkIntervalHours} giờ sử dụng setInterval (${intervalMs}ms)`);
    
    const intervalObj = setInterval(() => {
      checkAndAnnounceNews().catch(err => console.error('[Scheduler Error] Lỗi kiểm tra tin tức định kỳ:', err.message));
    }, intervalMs);
    
    activeCronJob = {
      stop: () => clearInterval(intervalObj)
    };
    return;
  }

  activeCronJob = cron.schedule(cronExpression, () => {
    checkAndAnnounceNews().catch(err => console.error('[Scheduler Error] Lỗi kiểm tra tin tức định kỳ:', err.message));
  });
}

// Interaction (Slash Command) handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'setsyncchannel') {
      const channel = interaction.options.getChannel('channel');
      
      // Check if it's a text channel (type 0 is GuildText)
      if (channel.type !== 0) {
        return interaction.reply({
          content: '❌ Vui lòng chọn một **kênh văn bản** (Text Channel).',
          ephemeral: true
        });
      }

      saveConfig({ channelId: channel.id });
      
      return interaction.reply({
        content: `✅ Đã thiết lập kênh thông báo tin tức là <#${channel.id}>. Các sự kiện mới sẽ tự động được gửi vào đây!`,
        ephemeral: false
      });
    }

    if (commandName === 'checknews') {
      // Wrap deferReply to capture temporary 503 or network errors
      try {
        await interaction.deferReply();
      } catch (deferError) {
        console.error('[Lỗi Tương Tác] Không thể deferReply lệnh /checknews:', deferError.message);
        return; // Exit early as we cannot interact with this interaction anymore
      }
      
      try {
        const result = await checkAndAnnounceNews(true);
        const channelId = getAnnouncementChannelId();
        
        let replyMessage = `🔍 Đã hoàn thành kiểm tra tin tức!\n- Tìm thấy tổng cộng: **${result.checked}** bài viết trên trang chủ.`;
        
        if (!channelId) {
          replyMessage += `\n⚠️ **Cảnh báo**: Chưa cấu hình kênh thông báo. Hãy dùng lệnh \`/setsyncchannel\` hoặc cấu hình trong file \`.env\` để nhận thông báo.`;
        } else {
          replyMessage += `\n- Số bài đăng mới đã được gửi: **${result.posted}**`;
        }

        await interaction.editReply({ content: replyMessage });
      } catch (error) {
        console.error('[Lỗi Lệnh] Lỗi khi thực hiện /checknews:', error.message);
        try {
          await interaction.editReply({ content: `❌ Đã xảy ra lỗi khi kiểm tra tin tức: ${error.message}` });
        } catch (replyError) {
          console.error('[Lỗi Tương Tác] Không thể gửi thông báo lỗi đến tương tác:', replyError.message);
        }
      }
    }

    if (commandName === 'status') {
      const channelId = getAnnouncementChannelId();
      const sentArticles = loadSentArticles();
      
      const statusEmbed = new EmbedBuilder()
        .setTitle('⚙️ Trạng thái hoạt động của Bot Tin tức')
        .setColor('#E5C158')
        .addFields(
          { 
            name: 'Kênh thông báo', 
            value: channelId ? `<#${channelId}>` : '❌ Chưa cấu hình (Dùng `/setsyncchannel` hoặc .env)', 
            inline: false 
          },
          { 
            name: 'Tần suất kiểm tra', 
            value: `Mỗi **${checkIntervalHours}** giờ`, 
            inline: true 
          },
          { 
            name: 'Lần kiểm tra cuối', 
            value: lastCheckTime ? `🕒 ${lastCheckTime.toLocaleString()}` : 'Chưa kiểm tra lần nào', 
            inline: true 
          },
          { 
            name: 'Số bài viết đã lưu trữ', 
            value: `📂 ${sentArticles.length} bài viết`, 
            inline: true 
          }
        )
        .setFooter({ text: 'Bot đang hoạt động ổn định' })
        .setTimestamp();

      await interaction.reply({ embeds: [statusEmbed] });
    }
  } catch (error) {
    console.error(`[Lỗi Tương Tác] Lỗi không mong muốn khi xử lý lệnh /${commandName}:`, error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: `❌ Đã xảy ra lỗi hệ thống: ${error.message}` });
      } else if (!interaction.replied) {
        await interaction.reply({ content: `❌ Đã xảy ra lỗi hệ thống: ${error.message}`, ephemeral: true });
      }
    } catch (replyError) {
      console.error('[Lỗi Tương Tác] Không thể phản hồi lỗi tương tác:', replyError.message);
    }
  }
});

// Handle client errors to prevent crashes on network drops
client.on('error', error => {
  console.error('[Bot Error] Lỗi kết nối client Discord:', error);
});

// Handle unhandled promise rejections globally
process.on('unhandledRejection', error => {
  console.error('[Unhandled Rejection] Phát hiện Promise bị từ chối chưa được xử lý:', error);
});

// Handle uncaught exceptions globally
process.on('uncaughtException', error => {
  console.error('[Uncaught Exception] Phát hiện lỗi chưa được bắt:', error);
});

// Login Bot
client.login(token).catch(err => {
  console.error('[Error] Đăng nhập Discord thất bại:', err.message);
  process.exit(1);
});
