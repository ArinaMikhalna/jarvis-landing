// Robokassa · серверный редирект на оплату
// Деплоится как serverless-функция (Vercel/Netlify Node). Секреты — ТОЛЬКО из env, в коде их нет.
//
// Нужные переменные окружения (задать в кабинете хостинга, НЕ в коде):
//   ROBO_LOGIN  — MerchantLogin (идентификатор магазина)
//   ROBO_PASS1  — Пароль №1 (секретный, для подписи запроса)
//   ROBO_TEST   — '1' для тестового режима, иначе боевой
//
// URL-ы Result/Success/Fail настраиваются в кабинете Robokassa.

const crypto = require('crypto');

const PLANS = {
  baza: { sum: '990.00',  desc: 'Курс «Твой личный ДЖАРВИС за вечер» — тариф ПРОТОТИП' },
  pro:  { sum: '3990.00', desc: 'Курс «Твой личный ДЖАРВИС за вечер» — тариф ДЖАРВИС' },
};

module.exports = (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const plan = url.searchParams.get('plan') || 'pro';
    const p = PLANS[plan] || PLANS.pro;

    const login = process.env.ROBO_LOGIN;
    const pass1 = process.env.ROBO_PASS1;
    if (!login || !pass1) {
      res.statusCode = 500;
      res.end('Robokassa не настроен: задайте ROBO_LOGIN и ROBO_PASS1 в переменных окружения.');
      return;
    }

    const outSum = p.sum;
    const invId = 0; // 0 — Robokassa сама сгенерирует номер счёта
    const isTest = process.env.ROBO_TEST === '1' ? '1' : '0';

    // Подпись: md5(MerchantLogin:OutSum:InvId:Пароль№1)
    const signature = crypto
      .createHash('md5')
      .update(`${login}:${outSum}:${invId}:${pass1}`)
      .digest('hex');

    const params = new URLSearchParams({
      MerchantLogin: login,
      OutSum: outSum,
      InvId: String(invId),
      Description: p.desc,
      SignatureValue: signature,
      Culture: 'ru',
      Encoding: 'utf-8',
      IsTest: isTest,
    });

    res.statusCode = 302;
    res.setHeader('Location', `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`);
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.end('Ошибка формирования оплаты');
  }
};
