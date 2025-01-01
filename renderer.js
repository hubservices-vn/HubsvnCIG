document.addEventListener('DOMContentLoaded', () => {
    const updateMessage = document.getElementById('update-message');
    const installupdate = document.getElementById('install-update');

    window.electron.onUpdateAvailable(() => {
        if (updateMessage) {
            updateMessage.textContent = 'An update is available. Downloading...';
            updateMessage.classList.remove('hidden');
        }
    });

    window.electron.onUpdateDownloaded(() => {
        if (updateMessage) {
            updateMessage.textContent = 'Update downloaded. Restart to install.';
        }
        if (installupdate) {
            installupdate.classList.remove('hidden');
            installupdate.addEventListener('click', () => {
                window.electron.installUpdate();
            });
        }
    });
    // Registration page logic
    const form = document.getElementById('registration-form');
    const loadingOverlay = document.getElementById('loading-overlay');
    const phoneInput = document.getElementById('phone');
    const otpButton = document.getElementById('otp-button');
    const otpInput = document.getElementById('otp');
    const verifyButton = document.getElementById('verify-otp-button'); // New button for OTP verification
    const phoneError = document.getElementById('phone-error');
    const submitButton =document.getElementById('submit-button');
    const countdownText = document.getElementById('countdown');
    const timerElement = document.getElementById('timer');

    let generatedOtp = null;
    let isOtpRequestInProgress = false; // Prevents duplicate OTP requests
    let isOtpVerified = false; // Tracks OTP verification status

    // Disable submit button initially
    if (submitButton) {
        submitButton.disabled = true;
    }

    // Validate Vietnamese phone number
    function isValidVietnamesePhoneNumber(phone) {
        const vietnamesePhoneRegex = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/;
        return vietnamesePhoneRegex.test(phone);
    }

    if (otpButton && !otpButton.dataset.listenerAdded) {
        otpButton.dataset.listenerAdded = true; // Mark as already having a listener
        otpButton.addEventListener('click', async () => {
            if (isOtpRequestInProgress) {
                console.warn('OTP request already in progress.');
                return;
            }

            const phone = phoneInput.value.trim();

            if (!isValidVietnamesePhoneNumber(phone)) {
                phoneError.classList.remove('hidden');
                return;
            }

            phoneError.classList.add('hidden'); // Hide error if valid
            otpButton.disabled = true;
            otpButton.textContent = "Sending...";
            isOtpRequestInProgress = true; // Mark request as in progress

            // Generate a 6-digit OTP
            generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log('Generated OTP:', generatedOtp); // For debugging only; remove in production.

            try {
                // Format the phone number to international format
                const formattedPhone = phone.startsWith('0') ? `84${phone.slice(1)}` : phone;
                otpInput.disabled = false;
                verifyButton.disabled = false;
                // Send OTP via webhook
                const response = await fetch('https://n8n.hubs.vn/webhook/smsgateway', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phoneNumber: formattedPhone,
                        text: `Ma xac thuc tai HubsvnCIG cua ban la ${generatedOtp},`,
                        wait: "1",
                        source: "garena"
                    }),
                });
              
                if (!response.ok) {
                    throw new Error('Failed to send OTP.');
                }

     
                // Start countdown
            let countdown = 60;
           
            countdownText.classList.remove('hidden');
            otpButton.textContent = 'Get OTP';
            const startCountdown = () => {
                let countdown = 60;
                countdownText.classList.remove('hidden');
                otpButton.disabled = true;
                const interval = setInterval(() => {
                    timerElement.textContent = countdown--;
                    if (countdown < 0) {
                        clearInterval(interval);
                        countdownText.classList.add('hidden');
                        otpButton.disabled = false; // Enable button after countdown
                    }
                }, 1000);
            };
        } catch (error) {
            console.error('Error sending OTP:', error);
            alert('Failed to send OTP. Please try again.');
            otpButton.disabled = false;
            otpButton.textContent = 'Get OTP';
            isOtpRequestInProgress = false;
        }
        });
    }

    if (verifyButton && !verifyButton.dataset.listenerAdded) {
        verifyButton.dataset.listenerAdded = true; // Mark as already having a listener
        // Handle OTP verification
verifyButton.addEventListener('click', () => {
    const enteredOtp = otpInput.value.trim();
    if (enteredOtp === generatedOtp) {
        alert('OTP verified successfully.');
        isOtpVerified = true; // Mark OTP as verified
        submitButton.disabled = false;
        // Enable submit button after OTP verification
        if (submitButton) {
            submitButton.disabled = false;
        }

        // Disable verify button to prevent multiple verifications
        verifyButton.disabled = true;
    } else {
        alert('Invalid OTP. Please try again.');
    }
});
    }

    if (form && !form.dataset.listenerAdded) {
        form.dataset.listenerAdded = true; // Mark the form as having a listener
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form Submitted'); // Debugging log
            submitButton.disabled = true;

            // Hiển thị loading
            loadingOverlay.classList.remove('hidden');

            // Gather form data
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            const subscriptionElement = document.querySelector('input[name="subscription"]:checked');

            if (!subscriptionElement) {
                alert('Please select a subscription.');
                submitButton.disabled = false;
                return;
            }

            try {
                // Invoke the Electron handler to submit registration
                const result = await window.electron.invoke('submit-registration', {
                    ...data,
                    subscription: subscriptionElement.value,
                });

                if (result?.success) {
                    const orderId = result.data.orderId;
                    const price = subscriptionElement.dataset.price;
                    const qrUrl = `https://img.vietqr.io/image/MBBank-HUBSVN-0974489489-compact2.jpg?amount=${price}&addInfo=${orderId}&accountName=Cao%20Chi%20Dung`;

                    // Store billing summary data in localStorage
                    localStorage.setItem('billingSummary', JSON.stringify({
                        qrUrl,
                        orderId,
                        price,
                        filePath: result.data.filePath,
                        runParam: result.data.runParam,
                    }));

                    // Navigate to summary page
                    window.location.href = 'summary-page.html';
                } else {
                    alert('Registration failed. Please check your input.');
                }
            } catch (error) {
                console.error('Error during registration:', error);
                alert('An error occurred. Please try again later.');
            } finally {
                loadingOverlay.classList.add('hidden');
                submitButton.disabled = false;
            }
        });
    }
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard: ' + text);
        }).catch((err) => {
            console.error('Failed to copy text: ', err);
        });
    }
    
    const copyButton = document.getElementById('copy-button');
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            const textToCopy = copyButton.getAttribute('data-copy');
            copyToClipboard(textToCopy);
        });
    }

    // Download image functionality
    const downloadButton = document.querySelector('#download-button');
    const qrImage = document.querySelector('#qr-image');

    if (downloadButton && qrImage) {
        downloadButton.addEventListener('click', () => {
            const imageUrl = qrImage.src;
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = 'qr-code.png';
            link.click();
        });
    }
       // Summary page logic
    const billingSummary = JSON.parse(localStorage.getItem('billingSummary'));
    const statusMessage = document.getElementById('status-message'); // Select status message element

    if (billingSummary) {
        // Populate summary page elements
        const qrImage = document.getElementById('qr-image');
        const orderIdElement = document.getElementById('order-id');
        const priceElement = document.getElementById('price');
        const copyButton = document.getElementById('copy-button');
        const copyaccount = document.getElementById('copy-account');
        const downloadButton = document.getElementById('download-button');

        if (qrImage) qrImage.src = billingSummary.qrUrl;
        if (orderIdElement) orderIdElement.textContent = billingSummary.orderId;
        if (priceElement) priceElement.textContent = `${billingSummary.price} VND`;
        if (statusMessage) statusMessage.textContent = 'Ready to install.';
         // Dynamically set data-copy attribute for the copy button

    } else if (window.location.pathname.includes('summary-page.html')) {
        // Redirect to registration if billing data is missing
        console.error('Billing summary not found in localStorage.');
        alert('Billing information is missing. Redirecting to registration...');
        window.location.href = 'index.html';
    }

    const installButton = document.getElementById('install-button');
    if (installButton) {
        installButton.addEventListener('click', async () => {
            try {
                if (!billingSummary || !billingSummary.filePath || !billingSummary.runParam) {
                    if (statusMessage) {
                        statusMessage.textContent = 'Installer details are missing. Please try again.';
                    }
                    return;
                }

                const { filePath, runParam } = billingSummary;
                console.log('Installing with:', filePath, runParam);

                const installResult = await window.electron.invoke('install-installer', { filePath, runParam });

                if (installResult?.success) {
                    if (statusMessage) {
                        statusMessage.textContent = 'Installation completed successfully!';
                    }
                } else {
                    if (statusMessage) {
                        statusMessage.textContent = 'Installation failed. Please try again.';
                    }
                }
            } catch (error) {
                console.error('Error during installation:', error);
                if (statusMessage) {
                    statusMessage.textContent = 'An error occurred. Please try again later.';
                }
            }
        });
    }
});