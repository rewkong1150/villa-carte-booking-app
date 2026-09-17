# One-command deploy pipeline: type-check -> build -> upload to Synology NAS -> restart the
# PocketBase container via SSH (bypasses the Container Manager UI, which has shown a
# recurring "Container undefined does not exist" bug on this NAS) -> health-check the live URL.
#
# One-time setup required before this works -see DEPLOY.md:
#   1. Enable SSH on the NAS (Control Panel -> Terminal & SNMP -> Enable SSH service).
#   2. Authorize the deploy key: paste the contents of ~/.ssh/vcg_booking_deploy.pub into
#      the NAS user's ~/.ssh/authorized_keys (via File Station, or by SSH'ing in once
#      yourself with a password and appending it).
#   3. Fill in deploy.config.json (nasUser, remotePath, etc).
#
# Usage: npm run deploy

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $root 'deploy.config.json'

if (-not (Test-Path $configPath)) {
    Write-Host "deploy.config.json not found at $configPath" -ForegroundColor Red
    exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json

if ($config.nasUser -eq 'CHANGE_ME_your_dsm_username') {
    Write-Host "Edit deploy.config.json first: set nasUser (and remotePath if different) for your NAS." -ForegroundColor Red
    exit 1
}

$keyPath = $config.sshKeyPath -replace '^~', $HOME
$target = "$($config.nasUser)@$($config.nasHost)"
$sshOpts = @('-p', "$($config.nasPort)", '-i', $keyPath, '-o', 'StrictHostKeyChecking=accept-new')
$remotePath = $config.remotePath

function Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Fail($msg) {
    Write-Host "DEPLOY FAILED: $msg" -ForegroundColor Red
    exit 1
}

Push-Location $root
try {
    Step "1/5 Type-checking (tsc --noEmit)"
    npm run lint
    if ($LASTEXITCODE -ne 0) { Fail "Type errors found -fix them before deploying." }

    Step "2/5 Building production bundle (vite build + copy into pocketbase/pb_public)"
    npm run build:pb
    if ($LASTEXITCODE -ne 0) { Fail "Build failed." }

    Step "3/5 Uploading pb_public (clean replace), pb_migrations, pb_hooks to NAS"
    # pb_public is a build artifact with content-hashed filenames -wipe the remote copy
    # first so old hashed asset files never accumulate. pb_migrations/pb_hooks are NOT
    # wiped: migration files must never be deleted (that would rerun/break migration history).
    & ssh @sshOpts $target "mkdir -p '$remotePath/pb_public' '$remotePath/pb_migrations' '$remotePath/pb_hooks' && rm -rf '$remotePath/pb_public'/*"
    if ($LASTEXITCODE -ne 0) { Fail "Could not prepare remote directories over SSH. Check deploy.config.json and that the deploy key is authorized on the NAS." }

    # -O forces the legacy SCP protocol instead of modern scp's SFTP-based default -
    # this NAS's sshd doesn't have the SFTP subsystem enabled, which makes plain
    # `scp` fail with "subsystem request failed on channel 0 / Connection closed".
    & scp -O -P $config.nasPort -i $keyPath -o StrictHostKeyChecking=accept-new -r (Join-Path $root 'pocketbase\pb_public\*') "${target}:$remotePath/pb_public/"
    if ($LASTEXITCODE -ne 0) { Fail "Upload of pb_public failed." }

    & scp -O -P $config.nasPort -i $keyPath -o StrictHostKeyChecking=accept-new (Join-Path $root 'pb_migrations\*.js') "${target}:$remotePath/pb_migrations/"
    if ($LASTEXITCODE -ne 0) { Fail "Upload of pb_migrations failed." }

    & scp -O -P $config.nasPort -i $keyPath -o StrictHostKeyChecking=accept-new (Join-Path $root 'pb_hooks\*.js') "${target}:$remotePath/pb_hooks/"
    if ($LASTEXITCODE -ne 0) { Fail "Upload of pb_hooks failed." }

    Step "4/5 Restarting the container via SSH (docker compose, not the Container Manager UI)"
    # docker.sock on this NAS is root-only (admin is not in a docker/root group), so
    # talking to the daemon needs sudo. A NOPASSWD sudoers.d rule scoped to just
    # /usr/local/bin/docker (set up once, see DEPLOY.md 9.5) lets this run non-interactively.
    $restartCmd = "cd '$remotePath' && sudo /usr/local/bin/docker compose restart"
    & ssh @sshOpts $target $restartCmd
    if ($LASTEXITCODE -ne 0) { Fail "Container restart command failed over SSH." }

    Step "5/5 Health check"
    Start-Sleep -Seconds 5
    try {
        $resp = Invoke-WebRequest -Uri $config.siteUrl -UseBasicParsing -TimeoutSec 15
        if ($resp.StatusCode -eq 200) {
            Write-Host ""
            Write-Host "DEPLOY OK -$($config.siteUrl) responded 200" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "Deploy finished, but $($config.siteUrl) responded with status $($resp.StatusCode) -check it manually." -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "Deploy finished, but the health check request failed: $($_.Exception.Message) -check the site manually." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
