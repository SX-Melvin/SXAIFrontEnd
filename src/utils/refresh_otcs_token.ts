import { OTCS_OAUTH_URL } from "../config/env";

export function refreshOTCSToken(): Promise<string> {
    return new Promise((resolve, reject) => {
        const popup = window.open(OTCS_OAUTH_URL, '_blank', 'width=500,height=600');

        if (!popup) {
            reject(new Error('Popup blocked'));
            return;
        }

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'otcs_token') {
                window.removeEventListener('message', handleMessage);
                clearInterval(pollTimer);
                const accessToken = event.data.access_token;
                localStorage.setItem('otcs_access_token', accessToken);
                popup.close();
                resolve(accessToken);
            }
        };

        // Detect if user closes the popup before completing auth
        const pollTimer = setInterval(() => {
            if (popup.closed) {
                clearInterval(pollTimer);
                window.removeEventListener('message', handleMessage);
                reject(new Error('Popup closed before authentication completed'));
            }
        }, 500);

        window.addEventListener('message', handleMessage);
    });
}