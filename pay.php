<?php
/**
 * Robokassa — серверный редирект на оплату (версия для Beget / PHP).
 * Секреты НЕ в коде: лежат в config.php (его в git не коммитим).
 * Кнопки сайта ведут сюда: /pay.php?plan=baza  и  /pay.php?plan=pro
 */

$cfg = file_exists(__DIR__ . '/config.php') ? (include __DIR__ . '/config.php') : [];

$PLANS = [
  'baza' => ['sum' => '990.00',  'desc' => 'Курс «Твой личный ДЖАРВИС за вечер» — тариф ПРОТОТИП'],
  'pro'  => ['sum' => '3990.00', 'desc' => 'Курс «Твой личный ДЖАРВИС за вечер» — тариф ДЖАРВИС'],
];

$plan = isset($_GET['plan']) && isset($PLANS[$_GET['plan']]) ? $_GET['plan'] : 'pro';
$p = $PLANS[$plan];

$login = $cfg['ROBO_LOGIN'] ?? getenv('ROBO_LOGIN');
$pass1 = $cfg['ROBO_PASS1'] ?? getenv('ROBO_PASS1');
$isTest = (($cfg['ROBO_TEST'] ?? getenv('ROBO_TEST')) === '1') ? '1' : '0';

if (!$login || !$pass1) {
  http_response_code(500);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'Robokassa не настроена: заполни config.php (ROBO_LOGIN и ROBO_PASS1).';
  exit;
}

$outSum = $p['sum'];
$invId  = 0; // 0 — Robokassa сама присвоит номер счёта

// Подпись: md5(MerchantLogin:OutSum:InvId:Пароль№1)
$signature = md5("$login:$outSum:$invId:$pass1");

$query = http_build_query([
  'MerchantLogin' => $login,
  'OutSum'        => $outSum,
  'InvId'         => $invId,
  'Description'   => $p['desc'],
  'SignatureValue'=> $signature,
  'Culture'       => 'ru',
  'Encoding'      => 'utf-8',
  'IsTest'        => $isTest,
]);

header('Location: https://auth.robokassa.ru/Merchant/Index.aspx?' . $query, true, 302);
exit;
