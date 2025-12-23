const electronInstaller = require('electron-winstaller');
const path = require('path');

async function createInstaller() {
    console.log('Creating Windows installer...');
    console.log('This may take a few minutes...');
    
    try {
        await electronInstaller.createWindowsInstaller({
            appDirectory: path.join(__dirname, 'release', 'Gate 1 Agent-win32-x64'),
            outputDirectory: path.join(__dirname, 'installer'),
            authors: 'Gate 1 System',
            exe: 'Gate 1 Agent.exe',
            name: 'Gate1Agent',
            title: 'Gate 1 Agent',
            description: 'Gate 1 System Desktop Agent for Editors',
            version: '1.0.0',
            setupExe: 'Gate1Agent-Setup.exe',
            noMsi: true,
        });
        
        console.log('');
        console.log('========================================');
        console.log(' Installer created successfully!');
        console.log('========================================');
        console.log('');
        console.log('Output: installer/Gate1Agent-Setup.exe');
        console.log('');
    } catch (e) {
        console.error('Error creating installer:', e.message);
        process.exit(1);
    }
}

createInstaller();
