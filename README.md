# Windscribe VPN Tester

Automated tool that tests every combination of **location x protocol:port** on Windscribe VPN and reports which ones work, along with latency and connection time. Useful for finding the fastest and most reliable VPN configurations for your network.

Works on **macOS** and **Windows**.

## How It Works

The script iterates over all Windscribe server locations and protocol/port combinations, connects via `windscribe-cli`, checks connectivity, measures latency, and records the results to JSON and CSV files.

## Prerequisites

### Both Platforms

- **Node.js >= 18** — [Download](https://nodejs.org/)
- **Windscribe Desktop App** — [Download](https://windscribe.com/download)
  - Must be **installed**, **running**, and **logged in** before running the script

### macOS

1. Install Windscribe from the [official website](https://windscribe.com/download) or via Homebrew:
   ```bash
   brew install --cask windscribe
   ```
2. Verify `windscribe-cli` is available:
   ```bash
   windscribe-cli status
   ```
   If the command is not found, the CLI is bundled inside the app. You may need to add it to your PATH:
   ```bash
   export PATH="/Applications/Windscribe.app/Contents/Helpers:$PATH"
   ```
   Or create a symlink:
   ```bash
   sudo ln -s /Applications/Windscribe.app/Contents/Helpers/windscribe-cli /usr/local/bin/windscribe-cli
   ```

### Windows

1. Install Windscribe from the [official website](https://windscribe.com/download).
2. The installer adds `windscribe-cli.exe` to your system. Verify it works:
   ```powershell
   windscribe-cli.exe status
   ```
   If the command is not found, add the Windscribe installation directory to your PATH. The default location is:
   ```
   C:\Program Files\Windscribe\
   ```
   To add it to PATH temporarily in PowerShell:
   ```powershell
   $env:PATH += ";C:\Program Files\Windscribe"
   ```
   Or add it permanently via **Settings > System > About > Advanced system settings > Environment Variables**.

## Installation

```bash
git clone https://github.com/KianooshSoleimani/windscribe-vpn-tester.git
cd windscribe-vpn-tester
npm install
```

This installs the only dependency: [`p-limit`](https://www.npmjs.com/package/p-limit) (concurrency limiter).

## Usage

```bash
node windscribe-tester.mjs [options]
```

### Options

| Flag                   | Description                                | Default |
| ---------------------- | ------------------------------------------ | ------- |
| `--protocols <list>`   | Comma-separated protocols to test          | all     |
| `--ports <list>`       | Comma-separated ports to test              | all     |
| `--continents <list>`  | Comma-separated continents to filter by    | all     |
| `-h, --help`           | Show help message                          | —       |

### Available Protocols

| Protocol    | Ports                                                   |
| ----------- | ------------------------------------------------------- |
| `wireguard` | 443, 80, 53, 123, 1194, 65142                          |
| `udp`       | 443, 80, 53, 123, 1194, 54783                          |
| `tcp`       | 443, 587, 21, 22, 80, 123, 3306, 8080, 54783, 1194    |
| `wstunnel`  | 443                                                     |
| `stealth`   | 443, 587, 21, 22, 80, 123, 3306, 8080, 54783, 8443    |
| `ikev2`     | 500                                                     |

### Available Continents

`asia`, `europe`, `north america`, `south america`, `oceania`, `africa`, `antarctica`

## Examples

```bash
# Run all tests (no filters) — tests every location with every protocol:port
node windscribe-tester.mjs

# WireGuard only, port 80, Asia locations
node windscribe-tester.mjs --protocols wireguard --ports 80 --continents asia

# WireGuard on ports 80 and 443
node windscribe-tester.mjs --protocols wireguard --ports 80,443

# Multiple protocols, single port
node windscribe-tester.mjs --protocols wireguard,udp --ports 80

# All protocols, Europe only
node windscribe-tester.mjs --continents europe

# Continents with spaces in the name
node windscribe-tester.mjs --continents "north america,south america"

# Stealth protocol, Asia and Europe
node windscribe-tester.mjs --protocols stealth --continents asia,europe

# IKEv2 only (only has port 500)
node windscribe-tester.mjs --protocols ikev2

# All protocols on ports 443 and 80
node windscribe-tester.mjs --ports 443,80
```

## Output

Results are automatically saved to:

- **`results.json`** — full results with all fields
- **`results.csv`** — tabular format for spreadsheets

Files are saved incrementally (every 10 tests) and on completion. If you interrupt with `Ctrl+C`, partial results are saved before exit.

### Output Fields

| Field             | Description                              |
| ----------------- | ---------------------------------------- |
| `timestamp`       | ISO 8601 timestamp of the test           |
| `location`        | Windscribe server location name          |
| `country_code`    | Two-letter country code                  |
| `continent`       | Continent of the server                  |
| `protocol`        | Protocol used (wireguard, udp, tcp, etc) |
| `port`            | Port number                              |
| `premium_only`    | Whether the location requires a paid plan|
| `success`         | Whether the connection succeeded         |
| `public_ip`       | Public IP address while connected        |
| `latency_ms`      | Ping latency to 1.1.1.1 (ms)            |
| `connect_time_ms` | Time to establish the connection (ms)    |
| `error_message`   | Error description if the test failed     |

### Terminal Summary

After all tests complete, a summary is printed showing:

- Total / successful / failed test counts
- Success rate percentage
- Fastest protocol:port combination
- Fastest location
- Average latency by protocol:port
- Top 5 fastest locations

## Updating Locations

The file `windscribe-locations.json` contains the server list. To update it with the latest Windscribe locations, replace the file contents with fresh data from Windscribe's API or export it from their app.

## Notes

- The script connects and disconnects sequentially (one tunnel at a time) since `windscribe-cli` supports only one active connection.
- Each test has a 30-second connection timeout.
- Make sure no other VPN is active before running the script.
- Free Windscribe accounts can only connect to non-premium locations. Premium locations will fail unless you have a paid plan.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
