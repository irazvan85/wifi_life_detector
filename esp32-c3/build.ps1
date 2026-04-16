<#
.SYNOPSIS
    Compile and flash the VitalScan ESP32-C3 firmware.

.DESCRIPTION
    arduino-cli requires the sketch folder name to match the main .ino file
    (without extension). Because our source lives in "esp32-c3.ino\" (folder
    ends in .ino), arduino-cli gets confused and looks for esp32-c3.ino.ino.

    This script stages the sketch files into a correctly-named temp folder
    ("esp32-c3") before compiling, then uploads to COM5.

.PARAMETER Port
    Serial port of the ESP32-C3. Default: COM5

.PARAMETER SkipUpload
    Compile only; do not flash.

.EXAMPLE
    .\build.ps1
    .\build.ps1 -Port COM3
    .\build.ps1 -SkipUpload
#>
param(
    [string]$Port       = "COM5",
    [switch]$SkipUpload
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
$SRC_DIR    = "$PSScriptRoot"                      # ...\esp32-c3.ino\
$STAGE_DIR  = "$env:TEMP\esp32-c3"                 # correctly-named sketch folder
$BUILD_DIR  = "$env:TEMP\esp32-c3-build"
$LIB_DIR    = "$env:USERPROFILE\Documents\Arduino\libraries"
$FQBN       = "esp32:esp32:esp32c3:CDCOnBoot=cdc"

# ---------------------------------------------------------------------------
# Stage source files into a correctly-named temp folder
# (arduino-cli demands folder name == sketch name without .ino)
# ---------------------------------------------------------------------------
Write-Host "[1/4] Staging sketch files to $STAGE_DIR ..." -ForegroundColor Cyan

if (Test-Path $STAGE_DIR) { Remove-Item $STAGE_DIR -Recurse -Force }
New-Item -ItemType Directory $STAGE_DIR | Out-Null

# Copy .ino and .h files only (skip readme etc.)
Get-ChildItem $SRC_DIR -File | Where-Object { $_.Extension -in ".ino", ".h", ".cpp" } |
    ForEach-Object { Copy-Item $_.FullName -Destination $STAGE_DIR }

# ---------------------------------------------------------------------------
# Verify arduino-cli is on PATH
# ---------------------------------------------------------------------------
if (-not (Get-Command arduino-cli -ErrorAction SilentlyContinue)) {
    Write-Error "arduino-cli not found on PATH. Install it from https://arduino.github.io/arduino-cli/"
}

# ---------------------------------------------------------------------------
# Compile
# ---------------------------------------------------------------------------
Write-Host "[2/4] Compiling for $FQBN ..." -ForegroundColor Cyan

$compileArgs = @(
    "compile"
    "--fqbn", $FQBN
    # WebSockets (Links2004) is IDF5-compatible; avoids the AsyncTCP/lwIP
    # core-lock crash (tcp_alloc assert) that afflicts ESPAsyncWebServer on
    # ESP32 Arduino core 3.x / IDF 5.x.
    "--library", "$LIB_DIR\WebSockets"
    "--library", "$LIB_DIR\ArduinoJson"
    "--library", "$LIB_DIR\U8g2"
    "--build-path", $BUILD_DIR
    "--warnings", "default"
    $STAGE_DIR
)

& arduino-cli @compileArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Compilation failed (exit $LASTEXITCODE). Fix errors above and retry."
}

Write-Host "[3/4] Compilation succeeded." -ForegroundColor Green

if ($SkipUpload) {
    Write-Host "SkipUpload set - done. Binary in: $BUILD_DIR" -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
Write-Host "[4/4] Uploading to $Port ..." -ForegroundColor Cyan

$uploadArgs = @(
    "upload"
    "--fqbn", $FQBN
    "--port", $Port
    "--input-dir", $BUILD_DIR
    $STAGE_DIR
)

& arduino-cli @uploadArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Upload failed (exit $LASTEXITCODE). Ensure the board is connected and $Port is correct."
}

Write-Host "Done. Board flashed successfully on $Port." -ForegroundColor Green
