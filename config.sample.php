<?php
/**
 * ОБРАЗЕЦ конфига Robokassa.
 * 1) Скопируй этот файл рядом и назови config.php
 * 2) Впиши свои данные из кабинета Robokassa
 * 3) config.php в git НЕ попадёт (он в .gitignore) — секрет не утечёт
 */
return [
  'ROBO_LOGIN' => 'идентификатор_магазина',   // MerchantLogin из кабинета Robokassa
  'ROBO_PASS1' => 'пароль_1',                  // Пароль №1 (секретный)
  'ROBO_TEST'  => '1',                         // '1' — тестовый режим, '0' — боевой
];
