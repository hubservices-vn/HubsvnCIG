document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const qrUrl = urlParams.get('qrUrl');
    const subscription = urlParams.get('subscription');
    const price = urlParams.get('price');

    if (!orderId || !qrUrl || !subscription || !price) {
        console.error('Missing required parameters.');
        return;
    }

    // Populate the summary page with details
    document.getElementById('order-id').textContent = `Order ID: ${orderId}`;
    document.getElementById('qr-image').src = qrUrl;
    document.getElementById('subscription-info').textContent = `Subscription: ${subscription} months`;
    document.getElementById('price-info').textContent = `Price: ${price} VND`;

    // Handle install button
    document.getElementById('install-button').addEventListener('click', async () => {
        try {
            const result = await window.electron.invoke('install-installer');
            if (result?.success) {
                alert('Installation completed!');
            } else {
                alert('Installation failed. Please try again.');
            }
        } catch (error) {
            console.error('An error occurred during installation:', error);
            alert('An error occurred. Please try again later.');
        }
    });
});
