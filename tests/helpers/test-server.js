// tests/helpers/test-server.js
function startTestServer(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${address.port}`
            });
        });
    });
}

function stopTestServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function extractCookie(response) {
    const setCookie = response.headers.get('set-cookie');
    return setCookie ? setCookie.split(';', 1)[0] : '';
}

module.exports = { startTestServer, stopTestServer, extractCookie };
