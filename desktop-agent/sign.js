/**
 * Code Signing Script for Gate 1 Agent
 * Powered by Nelium Systems
 * 
 * This script handles Windows code signing during the build process.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Purchase a code signing certificate from a trusted CA:
 *    - DigiCert (recommended): https://www.digicert.com/signing/code-signing-certificates
 *    - Sectigo: https://sectigo.com/ssl-certificates-tls/code-signing
 *    - GlobalSign: https://www.globalsign.com/en/code-signing-certificate
 * 
 * 2. For EV (Extended Validation) certificates (recommended for SmartScreen):
 *    - Requires hardware token (USB)
 *    - Set CSC_LINK to point to the certificate
 *    - Set CSC_KEY_PASSWORD for the token PIN
 * 
 * 3. For standard OV certificates:
 *    - Export as .pfx file
 *    - Set CSC_LINK=path/to/certificate.pfx
 *    - Set CSC_KEY_PASSWORD=your_password
 * 
 * 4. Environment variables required:
 *    - CSC_LINK: Path to .pfx certificate or certificate thumbprint
 *    - CSC_KEY_PASSWORD: Certificate password or token PIN
 * 
 * 5. For Azure SignTool (alternative):
 *    - AZURE_KEY_VAULT_URI
 *    - AZURE_CLIENT_ID
 *    - AZURE_TENANT_ID
 *    - AZURE_CLIENT_SECRET
 *    - AZURE_CERT_NAME
 */

const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(configuration) {
    // Skip signing if no certificate is configured
    if (!process.env.CSC_LINK && !process.env.WINDOWS_CERTIFICATE_FILE) {
        console.log('⚠️  Code signing skipped: No certificate configured');
        console.log('   Set CSC_LINK and CSC_KEY_PASSWORD environment variables to enable signing');
        return;
    }

    const filePath = configuration.path;
    const fileName = path.basename(filePath);
    
    console.log(`🔏 Signing: ${fileName}`);

    try {
        // Option 1: Use signtool with PFX certificate
        if (process.env.CSC_LINK) {
            const certPath = process.env.CSC_LINK;
            const certPassword = process.env.CSC_KEY_PASSWORD || '';
            
            // Using Windows SDK signtool
            const signtoolPath = findSignTool();
            
            if (signtoolPath) {
                const command = `"${signtoolPath}" sign /f "${certPath}" /p "${certPassword}" /fd sha256 /tr http://timestamp.digicert.com /td sha256 /d "Gate 1 Agent" /du "https://neliumsystems.com" "${filePath}"`;
                
                execSync(command, { stdio: 'inherit' });
                console.log(`✅ Signed: ${fileName}`);
            } else {
                console.log('⚠️  signtool.exe not found. Install Windows SDK.');
            }
        }
        
        // Option 2: Use Azure SignTool for cloud-based signing
        if (process.env.AZURE_KEY_VAULT_URI) {
            const command = `AzureSignTool sign -kvu "${process.env.AZURE_KEY_VAULT_URI}" -kvi "${process.env.AZURE_CLIENT_ID}" -kvt "${process.env.AZURE_TENANT_ID}" -kvs "${process.env.AZURE_CLIENT_SECRET}" -kvc "${process.env.AZURE_CERT_NAME}" -tr http://timestamp.digicert.com -td sha256 "${filePath}"`;
            
            execSync(command, { stdio: 'inherit' });
            console.log(`✅ Signed with Azure: ${fileName}`);
        }
    } catch (error) {
        console.error(`❌ Signing failed for ${fileName}:`, error.message);
        // Don't throw - allow build to continue without signing for development
        if (process.env.CI) {
            throw error; // Fail in CI environment
        }
    }
};

function findSignTool() {
    const possiblePaths = [
        'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
        'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe',
        'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.18362.0\\x64\\signtool.exe',
        'C:\\Program Files (x86)\\Windows Kits\\8.1\\bin\\x64\\signtool.exe',
    ];
    
    const fs = require('fs');
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    
    // Try to find via PATH
    try {
        execSync('where signtool', { stdio: 'pipe' });
        return 'signtool';
    } catch {
        return null;
    }
}
