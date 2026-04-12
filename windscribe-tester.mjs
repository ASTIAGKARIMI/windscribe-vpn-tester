#!/usr/bin/env node

/**
 * Windscribe VPN — Location × Protocol Automated Tester (macOS / Windows)
 *
 * Loads locations from windscribe-locations.json, then tests every
 * combination of location × protocol:port via windscribe-cli.
 *
 * Prerequisites:
 *   - Node.js >= 18 (for built-in fetch)
 *   - npm i p-limit
 *   - Windscribe desktop app installed, running, and logged in
 *
 * Usage:
 *   node windscribe-tester.mjs [options]
 *
 * Options:
 *   --protocols <list>   Comma-separated protocols to test (e.g. wireguard,udp,tcp)
 *   --ports <list>       Comma-separated ports to test (e.g. 80,443)
 *   --continents <list>  Comma-separated continents to filter locations (e.g. asia,europe)
 *
 * Examples:
 *   node windscribe-tester.mjs --protocols wireguard --ports 80 --continents asia
 *   node windscribe-tester.mjs --protocols wireguard,udp --ports 80,443
 *   node windscribe-tester.mjs --continents "north america,europe"
 *   node windscribe-tester.mjs                  # runs all tests (no filters)
 */

import { exec }                    from 'node:child_process';
import { promisify }               from 'node:util';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath }           from 'node:url';
import { dirname, join }           from 'node:path';
import pLimit                      from 'p-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const execAsync = promisify(exec);

// ─── CLI argument parsing ────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { protocols: null, ports: null, continents: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--protocols' && args[i + 1]) {
      opts.protocols = args[++i].toLowerCase().split(',').map((s) => s.trim());
    } else if (args[i] === '--ports' && args[i + 1]) {
      opts.ports = args[++i].split(',').map((s) => parseInt(s.trim(), 10));
    } else if (args[i] === '--continents' && args[i + 1]) {
      opts.continents = args[++i].toLowerCase().split(',').map((s) => s.trim());
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: node windscribe-tester.mjs [options]

Options:
  --protocols <list>   Comma-separated protocols (wireguard,udp,tcp,wstunnel,stealth,ikev2)
  --ports <list>       Comma-separated ports (e.g. 80,443)
  --continents <list>  Comma-separated continents (asia,europe,"north america",oceania,africa,"south america",antarctica)
  -h, --help           Show this help message

Examples:
  node windscribe-tester.mjs --protocols wireguard --ports 80 --continents asia
  node windscribe-tester.mjs --protocols wireguard,udp --ports 80,443
  node windscribe-tester.mjs  (no filters — runs all tests)`);
      process.exit(0);
    }
  }

  return opts;
}

const CLI_OPTS = parseArgs();

// ─── Configuration ──────────────────────────────────────────────────────────────

// Each entry is [protocol, port] — syntax: windscribe-cli connect "Loc" protocol:port
const ALL_PROTOCOL_PORTS = [
  // WireGuard
  ['wireguard', 443], ['wireguard', 80], ['wireguard', 53],
  ['wireguard', 123], ['wireguard', 1194], ['wireguard', 65142],
  // UDP (OpenVPN)
  ['udp', 443], ['udp', 80], ['udp', 53],
  ['udp', 123], ['udp', 1194], ['udp', 54783],
  // TCP (OpenVPN)
  ['tcp', 443], ['tcp', 587], ['tcp', 21], ['tcp', 22], ['tcp', 80],
  ['tcp', 123], ['tcp', 3306], ['tcp', 8080], ['tcp', 54783], ['tcp', 1194],
  // WStunnel
  ['wstunnel', 443],
  // Stealth
  ['stealth', 443], ['stealth', 587], ['stealth', 21], ['stealth', 22],
  ['stealth', 80], ['stealth', 123], ['stealth', 3306], ['stealth', 8080],
  ['stealth', 54783], ['stealth', 8443],
  // IKEv2
  ['ikev2', 500],
];

const PROTOCOL_PORTS = ALL_PROTOCOL_PORTS.filter(([proto, port]) => {
  if (CLI_OPTS.protocols && !CLI_OPTS.protocols.includes(proto)) return false;
  if (CLI_OPTS.ports && !CLI_OPTS.ports.includes(port)) return false;
  return true;
});

const LOCATIONS_FILE     = join(__dirname, 'windscribe-locations.json');
const IS_WIN             = process.platform === 'win32';
const CLI                = IS_WIN ? 'windscribe-cli.exe' : 'windscribe-cli';

const MAX_RETRIES        = 0;          // no retries, single attempt per test
const CONNECT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS   = 2_000;
const COOLDOWN_MS        = 1_500;
const PING_TIMEOUT_S     = 5;

// windscribe-cli supports only ONE tunnel at a time
const CONCURRENCY = 1;

// ─── State ──────────────────────────────────────────────────────────────────────

const results  = [];
let   aborted  = false;

// ─── Utilities ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a CLI command and return only the non-JSON human-readable lines.
 * windscribe-cli on macOS prefixes output with JSON log lines like:
 *   {"tm": "...", "lvl": "info", "mod": "cli", "msg": "..."}
 * We strip those and return the plain text portion.
 */
async function run(cmd, timeoutMs = 15_000) {
  const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
  const allOutput = (stdout + '\n' + stderr);
  const lines = allOutput.split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('{'))
    .map((l) => l.trim());
  return lines.join('\n');
}

/** Run command and return ALL output (including JSON log lines) */
async function runRaw(cmd, timeoutMs = 15_000) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    return (stdout + '\n' + stderr).trim();
  } catch (err) {
    // execAsync rejects on non-zero exit — still return whatever output we got
    const out = ((err.stdout ?? '') + '\n' + (err.stderr ?? '')).trim();
    if (out) return out;
    throw err;
  }
}

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ─── Location fetching ──────────────────────────────────────────────────────────

function loadLocations() {
  const raw = readFileSync(LOCATIONS_FILE, 'utf-8');
  const json = JSON.parse(raw);

  const locationsMap = json?.data?.locations;
  if (!locationsMap || typeof locationsMap !== 'object') {
    throw new Error('Unexpected structure in windscribe-locations.json');
  }

  const locations = [];
  for (const [id, loc] of Object.entries(locationsMap)) {
    locations.push({
      id,
      name:         loc.name,
      country_code: loc.country_code,
      continent:    loc.continent,
      premium_only: !!loc.premium_only,
      p2p:          !!loc.p2p,
      pop_count:    loc.pops_enabled,
    });
  }

  if (locations.length === 0) {
    throw new Error('No locations found in windscribe-locations.json');
  }

  // Filter by continent if --continents was provided
  if (CLI_OPTS.continents) {
    const filtered = locations.filter((l) =>
      CLI_OPTS.continents.includes(l.continent.toLowerCase())
    );
    if (filtered.length === 0) {
      const available = [...new Set(locations.map((l) => l.continent))].join(', ');
      throw new Error(`No locations match continents: ${CLI_OPTS.continents.join(', ')}. Available: ${available}`);
    }
    return filtered;
  }

  return locations;
}

// ─── Windscribe CLI helpers ─────────────────────────────────────────────────────

async function connect(locationName, protocol, port) {
  // Use -n (non-blocking) so CLI returns immediately without waiting/hanging on errors
  try {
    await run(`${CLI} connect -n "${locationName}" ${protocol}:${port}`, 10_000);
  } catch { /* non-blocking may exit with error code, that's fine — we poll status */ }
}

async function disconnect() {
  try { await run(`${CLI} disconnect -n`, 10_000); } catch { /* best-effort */ }
  // Give the app a moment to fully tear down the tunnel
  await sleep(1_000);
}

async function getStatusDetails() {
  try {
    const raw = await runRaw(`${CLI} status`, 10_000);
    const details = {};
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*(.+?):\s+(.+)$/);
      if (match) details[match[1].trim()] = match[2].trim();
    }
    return details;
  } catch {
    return {};
  }
}

async function waitForConnection() {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const raw = await runRaw(`${CLI} status`, 10_000);

      // Success: connected
      if (/Connect state:\s*Connected/i.test(raw) &&
          !/Connect state:\s*Disconnected/i.test(raw)) {
        return;
      }

      // Early bail: connection failed or error state
      if (/Connect state:\s*(Disconnected|Error)/i.test(raw) &&
          Date.now() - (deadline - CONNECT_TIMEOUT_MS) > 8_000) {
        // If still disconnected/errored after 8s, the attempt failed
        throw new Error('Connection failed (app reported Disconnected/Error)');
      }
    } catch (err) {
      if (err.message.includes('Connection failed')) throw err;
      /* ignore transient failures */
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s`);
}

async function fetchPublicIP() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch('https://api.ipify.org?format=text', {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ipify HTTP ${res.status}`);
    return (await res.text()).trim();
  } finally {
    clearTimeout(timer);
  }
}

async function measureLatency() {
  // Windows: ping -n 1 -w 5000  |  macOS/Linux: ping -c 1 -W 5
  const cmd = IS_WIN
    ? `ping -n 1 -w ${PING_TIMEOUT_S * 1000} 1.1.1.1`
    : `ping -c 1 -W ${PING_TIMEOUT_S} 1.1.1.1`;

  const output = await runRaw(cmd, (PING_TIMEOUT_S + 5) * 1000);
  const match = output.match(/time[=<]\s*([\d.]+)\s*ms/i);
  return match ? parseFloat(match[1]) : null;
}

// ─── Single test run ────────────────────────────────────────────────────────────

async function runSingleTest(location, protocol, port, idx, total) {
  const tag = `[${idx}/${total}]`;
  process.stdout.write(
    `${tag} Testing ${location.name} (${location.country_code}) via ${protocol}:${port} … `
  );

  const result = {
    timestamp:      new Date().toISOString(),
    location:       location.name,
    country_code:   location.country_code,
    continent:      location.continent,
    protocol,
    port,
    premium_only:   location.premium_only,
    success:        false,
    public_ip:      null,
    latency_ms:     null,
    connect_time_ms: null,
    status_details: null,
    error_message:  null,
  };

  try {
    const connectStart = Date.now();
    await connect(location.name, protocol, port);
    await waitForConnection();
    result.connect_time_ms = Date.now() - connectStart;

    // Gather all details while connected
    const [ip, latency, status] = await Promise.all([
      fetchPublicIP(),
      measureLatency(),
      getStatusDetails(),
    ]);

    result.public_ip      = ip;
    result.latency_ms     = latency;
    result.status_details = status;
    result.success        = true;

    console.log(`OK`);
    console.log(`    ┌─────────────────────────────────────────────`);
    console.log(`    │ SUCCESS: ${location.name} (${location.country_code}) — ${location.continent}`);
    console.log(`    │ Protocol       : ${protocol}:${port}`);
    console.log(`    │ Public IP      : ${ip}`);
    console.log(`    │ Latency        : ${latency ?? '?'}ms`);
    console.log(`    │ Connect time   : ${result.connect_time_ms}ms`);
    if (status['IP'])              console.log(`    │ VPN IP         : ${status['IP']}`);
    if (status['Protocol'])        console.log(`    │ VPN Protocol   : ${status['Protocol']}`);
    if (status['Port'])            console.log(`    │ VPN Port       : ${status['Port']}`);
    if (status['Data usage'])      console.log(`    │ Data usage     : ${status['Data usage']}`);
    if (status['Connected since']) console.log(`    │ Connected since: ${status['Connected since']}`);
    // Log any other status fields not already shown
    const shown = new Set(['IP', 'Protocol', 'Port', 'Data usage', 'Connected since', 'Connect state']);
    for (const [k, v] of Object.entries(status)) {
      if (!shown.has(k)) console.log(`    │ ${k.padEnd(15)}: ${v}`);
    }
    console.log(`    └─────────────────────────────────────────────`);
  } catch (err) {
    result.error_message = (err.message ?? String(err)).split('\n')[0].trim();
    console.log(`FAIL — ${result.error_message}`);
  } finally {
    await disconnect();
    await sleep(COOLDOWN_MS);
  }

  return result;
}

// ─── Test with retries ──────────────────────────────────────────────────────────

async function testWithRetry(location, protocol, port, idx, total) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (aborted) return null;

    if (attempt > 0) {
      console.log(
        `  ↳ Retry ${attempt}/${MAX_RETRIES} for ${location.name} via ${protocol}:${port}`
      );
      await sleep(2_000);
    }

    const result = await runSingleTest(location, protocol, port, idx, total);
    if (result.success || attempt === MAX_RETRIES) return result;
  }
  return null;
}

// ─── Output writers ─────────────────────────────────────────────────────────────

function writeJSON(data, path = 'results.json') {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function writeCSV(data, path = 'results.csv') {
  const headers = [
    'timestamp', 'location', 'country_code', 'continent',
    'protocol', 'port', 'premium_only', 'success', 'public_ip',
    'latency_ms', 'connect_time_ms', 'error_message',
  ];

  const lines = [
    headers.join(','),
    ...data.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
  ];

  writeFileSync(path, lines.join('\n') + '\n', 'utf-8');
}

// ─── Summary ────────────────────────────────────────────────────────────────────

function printSummary(data, elapsed) {
  const total     = data.length;
  const successes = data.filter((r) => r.success);
  const failures  = total - successes.length;
  const rate      = total > 0 ? ((successes.length / total) * 100).toFixed(1) : '0.0';

  console.log('\n' + '═'.repeat(60));
  console.log('  SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Total tests      : ${total}`);
  console.log(`  Successful       : ${successes.length}`);
  console.log(`  Failed           : ${failures}`);
  console.log(`  Success rate     : ${rate}%`);
  console.log(`  Elapsed          : ${fmtDuration(elapsed)}`);

  if (successes.length > 0) {
    // fastest by protocol:port
    const byProtoPort = new Map();
    for (const r of successes) {
      if (r.latency_ms == null) continue;
      const key = `${r.protocol}:${r.port}`;
      const prev = byProtoPort.get(key);
      if (!prev || r.latency_ms < prev) byProtoPort.set(key, r.latency_ms);
    }
    if (byProtoPort.size > 0) {
      const sorted = [...byProtoPort.entries()].sort((a, b) => a[1] - b[1]);
      console.log(`  Fastest proto:port : ${sorted[0][0]} (${sorted[0][1]}ms)`);
    }

    // fastest by location
    const byLocation = new Map();
    for (const r of successes) {
      if (r.latency_ms == null) continue;
      const prev = byLocation.get(r.location);
      if (!prev || r.latency_ms < prev) byLocation.set(r.location, r.latency_ms);
    }
    if (byLocation.size > 0) {
      const sorted = [...byLocation.entries()].sort((a, b) => a[1] - b[1]);
      console.log(`  Fastest location : ${sorted[0][0]} (${sorted[0][1]}ms)`);
    }

    // average latency per protocol:port
    console.log('\n  Average latency by protocol:port:');
    const protoPortGroups = new Map();
    for (const r of successes) {
      if (r.latency_ms == null) continue;
      const key = `${r.protocol}:${r.port}`;
      if (!protoPortGroups.has(key)) protoPortGroups.set(key, []);
      protoPortGroups.get(key).push(r.latency_ms);
    }
    for (const [pp, vals] of [...protoPortGroups.entries()].sort((a, b) => {
      const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
      const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
      return avgA - avgB;
    })) {
      const avg = (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
      console.log(`    ${pp.padEnd(18)} ${avg}ms (${vals.length} tests)`);
    }

    // top 5 fastest locations
    if (byLocation.size > 1) {
      console.log('\n  Top 5 fastest locations:');
      const sorted = [...byLocation.entries()].sort((a, b) => a[1] - b[1]);
      for (const [loc, lat] of sorted.slice(0, 5)) {
        console.log(`    ${loc.padEnd(20)} ${lat}ms`);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  Results saved to results.json and results.csv`);
  console.log('═'.repeat(60) + '\n');
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────────

function setupSignalHandlers() {
  const shutdown = async (signal) => {
    if (aborted) return;
    aborted = true;
    console.log(`\n\n  Received ${signal} — shutting down gracefully …`);
    console.log('  Disconnecting VPN and saving partial results …\n');

    await disconnect();

    if (results.length > 0) {
      writeJSON(results);
      writeCSV(results);
      console.log(`  Saved ${results.length} partial result(s).\n`);
    }

    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  setupSignalHandlers();

  console.log('═'.repeat(60));
  const platform = IS_WIN ? 'Windows' : 'macOS';
  console.log(`  Windscribe VPN — Location × Protocol Tester (${platform})`);
  console.log('═'.repeat(60));
  if (CLI_OPTS.protocols)  console.log(`  Filter proto  : ${CLI_OPTS.protocols.join(', ')}`);
  if (CLI_OPTS.ports)      console.log(`  Filter ports  : ${CLI_OPTS.ports.join(', ')}`);
  if (CLI_OPTS.continents) console.log(`  Filter regions: ${CLI_OPTS.continents.join(', ')}`);
  console.log();

  // ── Verify windscribe-cli is available ──
  try {
    await runRaw(`${CLI} status`, 15_000);
    console.log('  CLI check     : OK');
  } catch {
    console.error(`ERROR: ${CLI} is not available or Windscribe app is not running.`);
    console.error('Install Windscribe, launch the app, and log in first.');
    process.exit(1);
  }

  // ── Ensure we start disconnected ──
  await disconnect();
  console.log('  Disconnected  : OK (clean slate)');

  // ── Load locations from local cache ──
  console.log('  Loading locations from windscribe-locations.json …');
  const locations = loadLocations();
  const freeCount    = locations.filter((l) => !l.premium_only).length;
  const premiumCount = locations.filter((l) =>  l.premium_only).length;

  console.log(`  Locations     : ${locations.length} (${freeCount} free, ${premiumCount} premium)`);
  const protocolList = [...new Set(PROTOCOL_PORTS.map(([p]) => p))].join(', ');
  console.log(`  Protocols     : ${protocolList}`);
  console.log(`  Proto:port    : ${PROTOCOL_PORTS.length} combinations`);

  const totalTests = locations.length * PROTOCOL_PORTS.length;
  console.log(`  Total tests   : ${totalTests}`);
  console.log(`  Max retries   : ${MAX_RETRIES}`);
  console.log(`  Concurrency   : ${CONCURRENCY}\n`);
  console.log('─'.repeat(60) + '\n');

  // ── Build test queue (all protocol:port combos per location, then next location) ──
  const queue = [];
  for (const location of locations) {
    for (const [protocol, port] of PROTOCOL_PORTS) {
      queue.push({ location, protocol, port });
    }
  }

  // ── Run tests ──
  const limit   = pLimit(CONCURRENCY);
  const started = Date.now();

  const tasks = queue.map(({ location, protocol, port }, i) =>
    limit(async () => {
      if (aborted) return;

      const idx = i + 1;
      const result = await testWithRetry(location, protocol, port, idx, totalTests);

      if (result) {
        results.push(result);

        // incremental save every 10 tests
        if (results.length % 10 === 0) {
          writeJSON(results);
          writeCSV(results);
        }
      }
    })
  );

  await Promise.all(tasks);

  const elapsed = Date.now() - started;

  // ── Ensure disconnected ──
  await disconnect();

  // ── Save final results ──
  writeJSON(results);
  writeCSV(results);

  // ── Print summary ──
  printSummary(results, elapsed);
}

// ─── Entry point ────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('\nFatal error:', err.message ?? err);
  disconnect().finally(() => process.exit(1));
});
