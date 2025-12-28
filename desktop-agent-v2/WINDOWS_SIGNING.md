# Gate 1 Agent — Windows Code Signing (NSIS EXE)

This project uses **electron-builder**. Code signing is required to reduce/avoid Windows SmartScreen warnings.

## Important reality check (SmartScreen)

- A standard code-signing certificate helps, but **SmartScreen reputation** may still warn until the binary gains reputation.
- The fastest path to minimal warnings is an **EV Code Signing certificate** or a reputable cloud signing solution.

## Free option (testing only): self-signed certificate

You can sign builds for free using a self-signed certificate, but:

- It is **not publicly trusted**.
- SmartScreen warnings will still appear on machines that do not trust your certificate.
- It is useful for **controlled testing** where you can install your cert into Trusted Publishers.

### Create and export a self-signed code-signing cert (PowerShell)

Run in an elevated PowerShell (Admin):

```powershell
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Nelium Systems (Gate 1 Agent Test)" `
  -CertStoreLocation "Cert:\LocalMachine\My" `
  -KeyAlgorithm RSA -KeyLength 4096 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(3)

$pfxPass = ConvertTo-SecureString "ChangeMe-StrongPassword" -AsPlainText -Force

Export-PfxCertificate -Cert $cert -FilePath "C:\secrets\gate1-test-signing.pfx" -Password $pfxPass
Export-Certificate  -Cert $cert -FilePath "C:\secrets\gate1-test-signing.cer"
```

### Sign the installer EXE (signtool)

Install the Windows SDK (or Visual Studio Build Tools) to get `signtool.exe`.

Then sign:

```powershell
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe"
$exe = "C:\path\to\desktop-agent-v2\release\Gate 1 Agent-Setup-2.0.0-x64.exe"

& $signtool sign /fd SHA256 /a /f "C:\secrets\gate1-test-signing.pfx" /p "ChangeMe-StrongPassword" $exe
```

### Trust the certificate on test machines (optional)

Copy `gate1-test-signing.cer` to each test machine, then run (Admin):

```powershell
certutil -addstore -f "TrustedPublisher" C:\secrets\gate1-test-signing.cer
certutil -addstore -f "Root" C:\secrets\gate1-test-signing.cer
```

This can reduce warnings on those machines.

## Option A (recommended): EV Code Signing (Hardware token or cloud)

- Buy an **EV** certificate from a trusted CA (DigiCert / Sectigo / GlobalSign).
- Sign on the Windows build laptop.

### electron-builder (built-in) environment variables

electron-builder auto-detects signing when these are provided:

- `CSC_LINK`
  - Path to a `.p12` / `.pfx` file, or a base64-encoded certificate string.
- `CSC_KEY_PASSWORD`
  - Password for the `.p12` / `.pfx`.

Example (PowerShell):

```powershell
$env:CSC_LINK = "C:\\secrets\\nelium-gate1.pfx"
$env:CSC_KEY_PASSWORD = "<pfx_password>"

npm run dist:win
```

## Option B: Standard (OV) Code Signing

Same as above. OV may still show SmartScreen warnings early on.

## Timestamping (strongly recommended)

If your cert supports it, timestamps keep signatures valid after cert expiration.

electron-builder uses signtool under the hood; timestamping is typically handled automatically, but if you need to pin servers, we can add `signtoolOptions`.

Common timestamp servers:
- DigiCert: `http://timestamp.digicert.com`
- Sectigo: `http://timestamp.sectigo.com`

## Option C: Azure Trusted Signing / SignPath (cloud signing)

If you want minimal local secrets on the laptop, use a cloud signing provider.

- Azure Trusted Signing (needs Azure setup)
- SignPath (integrates with CI and/or local)

These usually require a different signing step after build (sign the produced EXE), or a custom electron-builder signing hook.

## Verification (Windows)

After building the installer exe:

```powershell
Get-AuthenticodeSignature .\release\"Gate 1 Agent-Setup-<version>-x64.exe" | Format-List
```

You should see `Status : Valid`.
