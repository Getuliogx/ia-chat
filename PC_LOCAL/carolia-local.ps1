param([switch]$Stop)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Port = 11435
$Base = Join-Path $env:LOCALAPPDATA 'CarolIA-Local'
$RuntimeDir = Join-Path $Base 'llama.cpp'
$ModelDir = Join-Path $Base 'models'
$LogDir = Join-Path $Base 'logs'
$PidFile = Join-Path $Base 'llama-server.pid'
$ModelFile = Join-Path $ModelDir 'Qwen3-0.6B.Q4_K_M.gguf'
$ModelSha256 = '7af3fdf842f87b24672f8a7f1dd50404043f0bfb71093ff91c31d2b49df4631d'
$LlamaZipUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b10952/llama-b10952-bin-win-cpu-x64.zip'
$ModelUrl = 'https://huggingface.co/QuantFactory/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B.Q4_K_M.gguf'

function Write-Title($text) {
    Write-Host ''
    Write-Host ('=' * 68) -ForegroundColor DarkMagenta
    Write-Host ('  ' + $text) -ForegroundColor Magenta
    Write-Host ('=' * 68) -ForegroundColor DarkMagenta
}

function Test-LocalServer {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -Method Get -TimeoutSec 2
        return $true
    } catch { return $false }
}

function Stop-LocalServer {
    if (Test-Path $PidFile) {
        $raw = (Get-Content $PidFile -Raw).Trim()
        if ($raw -match '^\d+$') {
            try { Stop-Process -Id ([int]$raw) -Force -ErrorAction Stop } catch {}
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    try {
        Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'" | Where-Object { $_.CommandLine -match "--port\s+$Port" } | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

function Download-File($Url, $Destination, $Label) {
    $tmp = $Destination + '.part'
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    Write-Host "Baixando $Label..." -ForegroundColor Cyan
    try {
        Import-Module BitsTransfer -ErrorAction Stop
        Start-BitsTransfer -Source $Url -Destination $tmp -DisplayName "CarolIA - $Label" -Description 'Download automatico da CarolIA'
    } catch {
        Write-Host 'BITS indisponivel; usando download HTTPS normal...' -ForegroundColor Yellow
        Invoke-WebRequest -Uri $Url -OutFile $tmp -UseBasicParsing
    }
    Move-Item $tmp $Destination -Force
}

if ($Stop) {
    Write-Title 'CarolIA Local - PARAR'
    Stop-LocalServer
    Write-Host 'IA local encerrada.' -ForegroundColor Green
    Start-Sleep -Seconds 2
    exit 0
}

Write-Title 'CarolIA Local - Qwen3 0.6B Q4 - modo leve'
Write-Host 'Nao usa Ollama. Nao instala servico. Nao precisa de chave de IA.' -ForegroundColor Gray
Write-Host "Arquivos locais: $Base" -ForegroundColor DarkGray

New-Item -ItemType Directory -Force -Path $Base,$RuntimeDir,$ModelDir,$LogDir | Out-Null

if (Test-LocalServer) {
    Write-Host "A IA local ja esta rodando em http://127.0.0.1:$Port" -ForegroundColor Green
    Write-Host 'Pode deixar esta janela fechar. O processo continua rodando.' -ForegroundColor Gray
    Start-Sleep -Seconds 3
    exit 0
}

$ServerExe = Get-ChildItem -Path $RuntimeDir -Filter 'llama-server.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $ServerExe) {
    $zip = Join-Path $Base 'llama-win-cpu.zip'
    Download-File $LlamaZipUrl $zip 'llama.cpp CPU x64'
    Write-Host 'Extraindo llama.cpp...' -ForegroundColor Cyan
    Remove-Item $RuntimeDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
    Expand-Archive -Path $zip -DestinationPath $RuntimeDir -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    $ServerExe = Get-ChildItem -Path $RuntimeDir -Filter 'llama-server.exe' -Recurse | Select-Object -First 1
    if (-not $ServerExe) { throw 'llama-server.exe nao foi encontrado depois da extracao.' }
}

if (-not (Test-Path $ModelFile)) {
    Download-File $ModelUrl $ModelFile 'Qwen3 0.6B Q4_K_M (~484 MB)'
}

Write-Host 'Verificando o modelo...' -ForegroundColor Cyan
$hash = (Get-FileHash -Path $ModelFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $ModelSha256) {
    Write-Host 'O arquivo do modelo veio incompleto ou diferente. Baixando novamente...' -ForegroundColor Yellow
    Remove-Item $ModelFile -Force
    Download-File $ModelUrl $ModelFile 'Qwen3 0.6B Q4_K_M (~484 MB)'
    $hash = (Get-FileHash -Path $ModelFile -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $ModelSha256) { throw 'Falha na verificacao SHA256 do modelo.' }
}

Stop-LocalServer
$stdout = Join-Path $LogDir 'llama-out.log'
$stderr = Join-Path $LogDir 'llama-error.log'
Remove-Item $stdout,$stderr -Force -ErrorAction SilentlyContinue

$serverPath = $ServerExe.FullName
$working = $ServerExe.DirectoryName
$arguments = @(
    '--model', ('"' + $ModelFile + '"'),
    '--host', '127.0.0.1',
    '--port', "$Port",
    '--ctx-size', '1024',
    '--threads', '2',
    '--threads-batch', '2',
    '--batch-size', '128',
    '--ubatch-size', '64',
    '--parallel', '1',
    '--n-predict', '96',
    '--reasoning', 'off',
    '--no-ui',
    '--no-warmup',
    '--cors-origins', '*'
) -join ' '

Write-Host 'Iniciando IA local em modo leve...' -ForegroundColor Cyan
$proc = Start-Process -FilePath $serverPath -ArgumentList $arguments -WorkingDirectory $working -WindowStyle Minimized -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$proc.Id | Set-Content -Path $PidFile -Encoding ASCII
try { $proc.PriorityClass = 'BelowNormal' } catch {}

$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Milliseconds 700
    if ($proc.HasExited) { break }
    if (Test-LocalServer) { $ready = $true; break }
}

if (-not $ready) {
    Write-Host 'A IA local nao iniciou corretamente.' -ForegroundColor Red
    Write-Host "Log: $stderr" -ForegroundColor Yellow
    if (Test-Path $stderr) { Get-Content $stderr -Tail 20 }
    Write-Host ''
    Read-Host 'Pressione ENTER para fechar'
    exit 1
}

Write-Host ''
Write-Host 'PRONTO: IA LOCAL ATIVA' -ForegroundColor Green
Write-Host "Servidor: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host 'Modelo: Qwen3 0.6B Q4_K_M' -ForegroundColor Green
Write-Host 'CPU: 2 threads | contexto: 1024 | reasoning: desligado' -ForegroundColor Green
Write-Host ''
Write-Host 'Agora deixe o Browser Source/Avatar da CarolIA aberto no OBS.' -ForegroundColor White
Write-Host 'As @mencoes nao entram no Timer; elas usam esta IA local.' -ForegroundColor White
Write-Host 'Para encerrar depois da live, clique em PARAR_CAROLIA_LOCAL.cmd.' -ForegroundColor Gray
Start-Sleep -Seconds 8
