<?php
/**
 * Same-origin enquiry handler (Orwell portfolio standard, 1 Oct 2026).
 *
 * Replaces FormSubmit, which stopped accepting submissions on about
 * 29 September 2026 (every POST returned HTTP 503 when tested on 30 Sep).
 *
 * Delivery: PHP mail() on the Hostinger account. Hostinger caps mail() at
 * 100 messages a day and 10 a minute for the WHOLE hosting account (shared by
 * every site on it). mail() messages carry no DKIM signature and fail DMARC
 * alignment, so:
 *   - the FROM domain's DMARC policy must be p=none (or absent), and
 *   - the FROM domain must be on the recipient's Outlook Safe senders list.
 * Every lead is written to a log OUTSIDE the web root before sending, so a
 * failed send never loses a lead.
 *
 * Accepts: POST as multipart/form-data, application/x-www-form-urlencoded or
 * application/json. Any field whose name starts with "_" is treated as
 * configuration or a honeypot and is not emailed.
 *
 * Responds:
 *   Accept: application/json -> {"ok":true,"ref":"..."} (200) only when mail()
 *                               accepted the message; {"ok":false,"error"} with
 *                               405/403/422/429/502 otherwise.
 *   plain form POST          -> 303 to LEAD_CONFIG['thank_you'], or a short
 *                               error page.
 *
 * Test without sending mail: require this file from a test script (the request
 * is only handled when this file is the script PHP was asked to run), then call
 * lead_handle($server, $post, $rawBody, $sender).
 */

declare(strict_types=1);

// ---------------------------------------------------------------- config ---
// Edit per site. A server-only override can live at
// dirname(DOCUMENT_ROOT)/lead-config.php (never in git): return an array with
// any of these keys.
const LEAD_CONFIG = [
    'brand'        => '{{BRAND_NAME}}',               // set by the launch find-and-replace (README); escape any ' in the name as \'
    'to'           => ['garethsomers@outlook.com'],   // one or more recipients (PHP source is never served)
    // TEMPORARY FROM: the site's domain has not been chosen, so this borrows
    // firswoodproperties.ae (DMARC p=none, already on Gareth's Outlook Safe
    // senders). AT LAUNCH change it to noreply@<the site's own domain>, and make
    // sure that domain has DMARC p=none (or no DMARC record) and is added to
    // Gareth's Outlook Safe senders list.
    'from'         => 'noreply@firswoodproperties.ae',
    'thank_you'    => '/thank-you/',                  // no-JS success redirect
    'log_key'      => 'solar',                        // folder name for the lead log
    'honeypots'    => ['_honey', '_gotcha', 'website_url', 'company_website'],
    'rate_max'     => 5,                              // submissions per IP ...
    'rate_window'  => 900,                            // ... per 15 minutes
    'allowed_origins' => [],                          // empty = same-origin only; list full origins to allow cross-site posts (relay)
    'sites'        => [],                             // relay only: key => ['brand'=>..., 'thank_you'=>...]
];

// ---------------------------------------------------------------- helpers ---

function lead_config(): array
{
    $cfg = LEAD_CONFIG;
    $root = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $path = ($root !== '' ? dirname($root) : dirname(__DIR__)) . '/lead-config.php';
    if (is_readable($path)) {
        $local = include $path;
        if (is_array($local)) {
            $cfg = array_merge($cfg, array_intersect_key($local, LEAD_CONFIG));
        }
    }
    return $cfg;
}

/** Remove control characters (keeping newlines/tabs), trim, cap length. */
function lead_clean(string $v, int $max): string
{
    $v = str_replace(["\r\n", "\r", "\0"], ["\n", "\n", ''], $v);
    $v = preg_replace('/[^\P{C}\n\t]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

function lead_one_line(string $v): string
{
    return trim(preg_replace('/\s+/u', ' ', $v) ?? '');
}

/** RFC 5322 display name: quoted when ASCII, encoded-word otherwise. */
function lead_display_name(string $name): string
{
    $name = lead_one_line($name);
    if (preg_match('/^[\x20-\x7E]*$/', $name)) {
        return '"' . addcslashes($name, '"\\') . '"';
    }
    return mb_encode_mimeheader($name, 'UTF-8', 'Q');
}

function lead_label(string $key): string
{
    $l = str_replace(['_', '-'], ' ', $key);
    return ucfirst(trim($l));
}

/** Flatten posted values (arrays such as checkbox groups become "a, b"). */
function lead_scalar($v): string
{
    if (is_array($v)) {
        return implode(', ', array_map(static fn($x) => is_scalar($x) ? (string) $x : '', $v));
    }
    return is_scalar($v) ? (string) $v : '';
}

/** Find the first field that looks like the enquirer's email / name / phone. */
function lead_pick(array $fields, array $patterns): string
{
    foreach ($patterns as $p) {
        foreach ($fields as $k => $v) {
            if ($v !== '' && preg_match($p, (string) $k)) {
                return $v;
            }
        }
    }
    return '';
}

/**
 * Validate a submission.
 * Returns ['ok'=>true,'fields'=>[...],'email'=>'','name'=>'','spam'=>bool] or ['ok'=>false,'error'=>'...'].
 */
function lead_validate(array $in, array $cfg): array
{
    foreach ($cfg['honeypots'] as $hp) {
        if (isset($in[$hp]) && trim(lead_scalar($in[$hp])) !== '') {
            return ['ok' => true, 'fields' => [], 'email' => '', 'name' => '', 'spam' => true];
        }
    }
    $fields = [];
    foreach ($in as $k => $v) {
        $k = (string) $k;
        if ($k === '' || $k[0] === '_' || in_array($k, $cfg['honeypots'], true)) {
            continue;
        }
        if (!preg_match('/^[A-Za-z0-9_\-\[\]\. ]{1,64}$/', $k)) {
            continue;
        }
        $raw = lead_scalar($v);
        if (mb_strlen($raw) > 10000) {
            return ['ok' => false, 'error' => lead_label($k) . ' is too long.'];
        }
        $isLong = (bool) preg_match('/message|details|notes|comment|enquiry|brief|description|requirements/i', $k);
        $val = lead_clean($raw, $isLong ? 5000 : 500);
        if (!$isLong) {
            $val = lead_one_line($val);
        }
        $fields[$k] = $val;
        if (count($fields) >= 40) {
            break;
        }
    }
    $email = lead_pick($fields, ['/^e-?mail$/i', '/email/i']);
    $phone = lead_pick($fields, ['/^(tel|phone|mobile|whatsapp)$/i', '/phone|mobile|tel|whatsapp/i']);
    $name  = lead_pick($fields, ['/^(full_?name|name|your_?name)$/i', '/first_?name/i', '/name/i']);
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        return ['ok' => false, 'error' => 'Please enter a valid email address.'];
    }
    if ($email === '' && $phone === '') {
        return ['ok' => false, 'error' => 'Please give an email address or phone number so we can reply.'];
    }
    if (count(array_filter($fields, static fn($v) => $v !== '')) === 0) {
        return ['ok' => false, 'error' => 'The form was empty.'];
    }
    return ['ok' => true, 'fields' => $fields, 'email' => $email, 'name' => $name, 'spam' => false];
}

/** Build the email. Returns [subject, body, headers, envelope]. */
function lead_compose(array $v, array $cfg, string $brand, string $id): array
{
    $f = $v['fields'];
    $who = $v['name'] !== '' ? $v['name'] : ($v['email'] !== '' ? $v['email'] : 'new enquiry');
    $topic = lead_pick($f, ['/^(interest|service|subject|enquiry_type|type|topic)$/i']);
    $tag = (stripos($who, 'HEALTHCHECK') === 0 || stripos(implode(' ', $f), 'HEALTHCHECK-') !== false) ? ' [HEALTHCHECK]' : '';
    $subject = '[' . $brand . ' enquiry]' . $tag . ' ' . ($topic !== '' ? $topic . ' | ' : '') . $who;
    $lines = [];
    $long = [];
    foreach ($f as $k => $val) {
        if ($val === '') {
            continue;
        }
        if (strpos($val, "\n") !== false || mb_strlen($val) > 200) {
            $long[] = "\n" . lead_label($k) . ":\n" . $val . "\n";
        } else {
            $lines[] = lead_label($k) . ': ' . $val;
        }
    }
    $body = implode("\n", array_merge($lines, $long))
        . "\n\nReference: " . $id
        . "\nReceived: " . gmdate('Y-m-d H:i') . " UTC"
        . "\nSite: " . $brand
        . ($v['email'] !== '' ? "\nReply to this email to answer the enquirer directly." : '')
        . "\n";
    $headers = [
        'From: ' . lead_display_name($brand . ' website') . ' <' . $cfg['from'] . '>',
    ];
    if ($v['email'] !== '') {
        $headers[] = 'Reply-To: ' . ($v['name'] !== '' ? lead_display_name($v['name']) . ' ' : '') . '<' . $v['email'] . '>';
    }
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: 8bit';
    $headers[] = 'X-Lead-Ref: ' . $id;
    return [mb_encode_mimeheader($subject, 'UTF-8', 'Q'), $body, implode("\r\n", $headers), $cfg['from']];
}

function lead_data_dir(array $cfg): string
{
    $root = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $above = $root !== '' ? dirname($root) : dirname(__DIR__);
    foreach ([$above . '/' . $cfg['log_key'] . '-leads', sys_get_temp_dir() . '/' . $cfg['log_key'] . '-leads'] as $dir) {
        if ((is_dir($dir) || @mkdir($dir, 0700, true)) && is_writable($dir)) {
            return $dir;
        }
    }
    return sys_get_temp_dir();
}

function lead_rate_ok(string $dir, string $ip, int $max, int $window, ?int $now = null): bool
{
    $now = $now ?? time();
    $file = $dir . '/rate-' . substr(hash('sha256', $ip), 0, 16) . '.json';
    $hits = is_readable($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    $hits = array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $now - $window));
    if (count($hits) >= $max) {
        return false;
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
    return true;
}

function lead_log(string $dir, array $entry): void
{
    @file_put_contents($dir . '/leads-' . gmdate('Y-m') . '.jsonl', json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

/** Origin of the request, from Origin or Referer. '' when neither is present. */
function lead_origin(array $server): string
{
    $o = $server['HTTP_ORIGIN'] ?? '';
    if ($o === '' && !empty($server['HTTP_REFERER'])) {
        $p = parse_url((string) $server['HTTP_REFERER']);
        if (!empty($p['scheme']) && !empty($p['host'])) {
            $o = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
        }
    }
    return strtolower(rtrim((string) $o, '/'));
}

/**
 * Handle one request. $sender = fn(string $to, string $subject, string $body, string $headers, string $envelope): bool
 * Returns ['json'=>bool,'code'=>int,'body'=>array,'redirect'=>string,'cors'=>string].
 */
function lead_handle(array $server, array $post, string $rawBody, callable $sender, ?array $cfg = null): array
{
    $cfg = $cfg ?? lead_config();
    $accept = (string) ($server['HTTP_ACCEPT'] ?? '');
    $ctype = (string) ($server['CONTENT_TYPE'] ?? '');
    $json = stripos($accept, 'application/json') !== false || stripos($ctype, 'application/json') !== false;
    $origin = lead_origin($server);
    $allowed = array_map('strtolower', $cfg['allowed_origins']);
    $cors = in_array($origin, $allowed, true) ? $origin : '';
    $out = static fn(int $code, array $body, string $redirect = '') => ['json' => $json, 'code' => $code, 'body' => $body, 'redirect' => $redirect, 'cors' => $cors];

    $method = (string) ($server['REQUEST_METHOD'] ?? '');
    if ($method === 'OPTIONS') {
        return $out($cors !== '' ? 204 : 403, []);
    }
    if ($method !== 'POST') {
        return $out(405, ['ok' => false, 'error' => 'Method not allowed.']);
    }
    // Cross-site posts only from listed origins. Same-origin posts (or none) are fine.
    $host = strtolower((string) ($server['HTTP_HOST'] ?? ''));
    if ($origin !== '' && $cors === '' && parse_url($origin, PHP_URL_HOST) !== $host) {
        return $out(403, ['ok' => false, 'error' => 'Not allowed.']);
    }

    $in = $post;
    if (stripos($ctype, 'application/json') !== false) {
        $decoded = json_decode($rawBody, true);
        if (!is_array($decoded)) {
            return $out(422, ['ok' => false, 'error' => 'Invalid request.']);
        }
        $in = $decoded;
    }

    // Relay: choose the site's brand and thank-you page from a posted key.
    $brand = $cfg['brand'];
    $thankYou = $cfg['thank_you'];
    if (!empty($cfg['sites'])) {
        $key = lead_scalar($in['_site'] ?? $in['site'] ?? '');
        if (!isset($cfg['sites'][$key])) {
            return $out(422, ['ok' => false, 'error' => 'Unknown site.']);
        }
        $brand = $cfg['sites'][$key]['brand'];
        $thankYou = $cfg['sites'][$key]['thank_you'];
        unset($in['site']);
    }

    $v = lead_validate($in, $cfg);
    if (!$v['ok']) {
        return $out(422, ['ok' => false, 'error' => $v['error']]);
    }
    if ($v['spam']) {
        return $out(200, ['ok' => true], $thankYou);
    }
    $dir = lead_data_dir($cfg);
    if (!lead_rate_ok($dir, (string) ($server['REMOTE_ADDR'] ?? '0.0.0.0'), (int) $cfg['rate_max'], (int) $cfg['rate_window'])) {
        return $out(429, ['ok' => false, 'error' => 'Too many enquiries from this connection. Please wait a few minutes and try again.']);
    }
    $id = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3));
    lead_log($dir, ['id' => $id, 'at' => gmdate('c'), 'status' => 'received', 'brand' => $brand, 'origin' => $origin, 'fields' => $v['fields']]);
    [$subject, $body, $headers, $envelope] = lead_compose($v, $cfg, $brand, $id);
    $sent = false;
    try {
        $sent = (bool) $sender(implode(', ', $cfg['to']), $subject, $body, $headers, $envelope);
    } catch (\Throwable $e) {
        $sent = false;
    }
    lead_log($dir, ['id' => $id, 'at' => gmdate('c'), 'status' => $sent ? 'sent' : 'send_failed']);
    if (!$sent) {
        return $out(502, ['ok' => false, 'error' => 'We could not send your enquiry just now. Please try again shortly or contact us directly.']);
    }
    return $out(200, ['ok' => true, 'ref' => $id], $thankYou);
}

function lead_emit(array $r): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    header('Cache-Control: no-store');
    if ($r['cors'] !== '') {
        header('Access-Control-Allow-Origin: ' . $r['cors']);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Accept');
        header('Access-Control-Max-Age: 86400');
    }
    if ($r['json'] || $r['code'] === 204) {
        http_response_code($r['code']);
        if ($r['code'] !== 204) {
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode($r['body']);
        }
        return;
    }
    if ($r['code'] === 200 && $r['redirect'] !== '') {
        header('Location: ' . $r['redirect'], true, 303);
        return;
    }
    http_response_code($r['code']);
    header('Content-Type: text/html; charset=UTF-8');
    $msg = htmlspecialchars((string) ($r['body']['error'] ?? 'Something went wrong.'), ENT_QUOTES, 'UTF-8');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Enquiry not sent</title></head>'
        . '<body style="font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1>Your enquiry was not sent</h1><p>'
        . $msg . '</p><p>Please go back and try again.</p></body></html>';
}

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    lead_emit(lead_handle($_SERVER, $_POST, (string) file_get_contents('php://input'), static function ($to, $subject, $body, $headers, $envelope) {
        return mail($to, $subject, $body, $headers, '-f' . $envelope);
    }));
}
