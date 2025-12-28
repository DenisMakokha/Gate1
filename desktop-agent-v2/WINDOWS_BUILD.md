# Gate 1 Agent (Windows) — Build the single NSIS Setup EXE

This project ships a single installer executable:

- `Gate 1 Agent-Setup-<version>-x64.exe`

## Verify signature (if signing configured)

```powershell
$exe = (Get-ChildItem .\release\*Setup*exe | Select-Object -First 1).FullName
Get-AuthenticodeSignature $exe | Format-List
```

You want:

- `Status : Valid`

It is produced by **electron-builder** using the **NSIS** target.

## Prerequisites (Windows build machine)

- Node.js LTS (18 or 20)
- npm (comes with Node)
- Git

> Recommended: build on a Windows VM or a dedicated Windows build machine.

## Build steps

1. Clone the repository
2. Open **PowerShell**
3. Go to the project folder:
   - `Gate1\desktop-agent-v2`
4. Install dependencies:

```powershell
npm ci
```

## (Recommended) Code signing

To reduce SmartScreen warnings, sign builds by setting these environment variables before building:

- `CSC_LINK` = path to your `.pfx` / `.p12`
- `CSC_KEY_PASSWORD` = password for the certificate

Example:

```powershell
$env:CSC_LINK = "C:\secrets\nelium-gate1.pfx"
$env:CSC_KEY_PASSWORD = "<pfx_password>"
```

Note: Public SmartScreen trust requires a paid certificate. The above flow is for real certificates.

## Free testing signing (self-signed)

For controlled testing (not public trust), you can self-sign.

1) Create/export the cert (Admin PowerShell):

```powershell
New-Item -ItemType Directory -Force -Path C:\secrets | Out-Null

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Nelium Systems (Gate 1 Agent Test)" `
  -CertStoreLocation "Cert:\LocalMachine\My" `
  -KeyAlgorithm RSA -KeyLength 4096 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(3)

$pfxPass = "ChangeMe-StrongPassword"
$sec = ConvertTo-SecureString $pfxPass -AsPlainText -Force

Export-PfxCertificate -Cert $cert -FilePath "C:\secrets\gate1-test-signing.pfx" -Password $sec
Export-Certificate  -Cert $cert -FilePath "C:\secrets\gate1-test-signing.cer"
```

2) Build unsigned installer:

```powershell
npm run dist:win
```

3) Sign the produced EXE (requires Windows SDK / signtool):

```powershell
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe"
$exe = (Get-ChildItem .\release\*Setup*exe | Select-Object -First 1).FullName

& $signtool sign /fd SHA256 /a /f "C:\secrets\gate1-test-signing.pfx" /p "ChangeMe-StrongPassword" $exe
```

4) (Optional) trust the cert on each test machine:

```powershell
certutil -addstore -f "TrustedPublisher" C:\secrets\gate1-test-signing.cer
certutil -addstore -f "Root" C:\secrets\gate1-test-signing.cer
```

## Output

The installer will be placed in:

- `desktop-agent-v2\release\`

Look for:

- `Gate 1 Agent-Setup-<version>-x64.exe`

## Notes

- The installer is **step-wise** (not one-click), **per-machine**, branded, and includes the license page.
- Auto-start on login is enabled (installer + runtime).
- If you do not configure signing, unsigned builds will trigger Windows SmartScreen warnings.

## Build in GitHub Actions (no Windows machine needed)

This repo includes a workflow that builds the Windows NSIS installer on `windows-latest` and uploads it as an artifact.

1. Push to `main`/`master` (or run it manually)
2. In GitHub: **Actions** → **Build Windows NSIS Installer**
3. Open the run → download artifact:
   - `Gate1Agent-NSIS-Setup`

The downloaded artifact contains:

- `Gate 1 Agent-Setup-<version>-x64.exe`
