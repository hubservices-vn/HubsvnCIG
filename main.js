const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const fetch = require('node-fetch');
const { autoUpdater } = require('electron-updater');

// Enable hot reload in development
if (process.env.NODE_ENV === 'development') {
    require('electron-reload')(path.join(__dirname), {
        electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
        awaitWriteFinish: true,
    });
}



let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450, // Set the desired width
        height: 950, // Set the desired height
        resizable: false, // Disable resizing
        movable: false, // Optional: Prevent window from being moved
        minimizable: false, // Disable minimize button
        maximizable: false, // Disable maximize button
        fullscreenable: false, // Disable fullscreen mode
        transparent: true, // Enables transparent background
        frame: false, // Removes the frame for modern styling
        titleBarStyle: 'hidden', // Hide the title bar
        alwaysOnTop: true, // Keeps the window above others
        fullscreenable: false, // Không cho phép fullscreen
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
    // Set the window to always stay on top
    mainWindow.setAlwaysOnTop(true, 'screen-saver');

    // Optionally disable scrolling for the entire page
    mainWindow.webContents.executeJavaScript(`
        document.body.style.overflow = 'hidden';
        document.body.style.scrollbarWidth = 'none'; // Firefox-specific
    `);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
// Listen to update events
autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
});

ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});
// IPC Handlers for window controls
ipcMain.on('window-control', (event, action) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();

    switch (action) {
        case 'minimize':
            focusedWindow.minimize();
            break;
        case 'maximize':
            if (focusedWindow.isMaximized()) {
                focusedWindow.unmaximize();
            } else {
                focusedWindow.maximize();
            }
            break;
        case 'close':
            focusedWindow.close();
            break;
    }
});

// Helper function to download files
async function downloadFile(url, filePath) {
    const fileStream = fs.createWriteStream(filePath);

    try {
        console.log(`Downloading from URL: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const readableStream = response.body;

        if (!readableStream) {
            throw new Error('Response body is null or not streamable');
        }

        readableStream.pipe(fileStream);

        return new Promise((resolve, reject) => {
            fileStream.on('finish', () => {
                console.log(`File downloaded successfully: ${filePath}`);
                resolve({ success: true, filePath });
            });
            fileStream.on('error', (error) => {
                console.error('Error writing file:', error);
                reject({ success: false, error });
            });
        });
    } catch (error) {
        console.error('Error during file download:', error);
        return { success: false, error };
    }
}

// IPC handler for registration
ipcMain.handle('submit-registration', async (event, registrationData) => {
    console.log('Submitting registration with data:', registrationData);

    try {
        // Validate input data
        if (!registrationData.name || !registrationData.email || !registrationData.subscription) {
            throw new Error('Missing required registration fields');
        }

        // Call the webhook
        const response = await fetch('https://n8n.hubs.vn/webhook/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData),
        });

        if (!response.ok) {
            throw new Error(`Webhook request failed with status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Webhook Response:', result);

        // Validate response fields
        if (!result.download_url || !result.runParam || !result.orderId) {
            throw new Error('Invalid webhook response: Missing required fields');
        }

        // Download the installer dynamically
        const filePath = path.join(app.getPath('downloads'), 'HubsvnCIG.exe');
        const downloadResult = await downloadFile(result.download_url, filePath);

        if (!downloadResult.success) {
            throw new Error(`File download failed: ${downloadResult.error || 'Unknown error'}`);
        }

        console.log('Installer downloaded successfully.');

        // Return the result to the renderer process
        return {
            success: true,
            data: {
                ...result,
                filePath: downloadResult.filePath, // Use filePath from the download function
            },
        };
    } catch (error) {
        console.error('Error in submit-registration:', error.message);
        return { success: false, error: error.message };
    }
});
ipcMain.handle('install-installer', async (event, { filePath, runParam }) => {
    try {
        if (!filePath || !runParam) {
            console.error('Missing installer file path or run parameters.');
            return { success: false, error: 'Missing installer file path or run parameters.' };
        }

        console.log('Preparing to run installer...');
        console.log('File Path:', filePath);
        console.log('Run Parameters:', runParam);

        const command = `powershell -Command "Start-Process '${filePath}' -ArgumentList '${runParam}' -Verb RunAs"`;
        console.log('Executing Command:', command);

        return await new Promise((resolve) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('Command execution error:', error.message);
                    console.error('stderr:', stderr);
                    resolve({ success: false, error: error.message });
                } else {
                    console.log('Command executed successfully. stdout:', stdout);
                    resolve({ success: true });
                }
            });
        });
    } catch (error) {
        console.error('Error in install-installer:', error.message);
        return { success: false, error: error.message };
    }
});
