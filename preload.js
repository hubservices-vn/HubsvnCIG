const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Update-related methods
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', (_, ...args) => callback(...args));
    },
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update-downloaded', (_, ...args) => callback(...args));
    },
    installUpdate: () => ipcRenderer.send('install-update'),

    // Invoking main process methods securely
    invoke: (channel, data) => {
        const validChannels = ['submit-registration', 'install-installer', 'send-otp', 'verify-otp']; // Added 'verify-otp'
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        } else {
            console.error(`Invalid channel: ${channel}. Allowed channels: ${validChannels.join(', ')}`);
        }
    },

    // Listening to events from the main process
    on: (channel, callback) => {
        const validChannels = ['otp-sent', 'otp-failed', 'otp-verified']; // Added 'otp-verified'
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (_, data) => callback(data));
        } else {
            console.error(`Invalid channel for listener: ${channel}. Allowed channels: ${validChannels.join(', ')}`);
        }
    },

    // Sending events to the main process
    send: (channel, data) => {
        const validChannels = ['send-otp', 'install-update', 'verify-otp']; // Added 'verify-otp'
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        } else {
            console.error(`Invalid channel for sending: ${channel}. Allowed channels: ${validChannels.join(', ')}`);
        }
    },
});
