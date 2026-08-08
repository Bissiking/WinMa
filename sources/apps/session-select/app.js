// sources/apps/session-select/app.js
(function initializeSessionScreen() {
    const button = document.getElementById('BtnConnexionWinMa');
    const status = document.getElementById('Infoconnexion');
    const query = new URLSearchParams(window.location.search);

    function setStatus(message) {
        status.textContent = message;
    }

    async function readSession() {
        try {
            const response = await fetch('/api/session', {
                headers: { accept: 'application/json' },
                credentials: 'same-origin'
            });
            const payload = await response.json();

            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Session indisponible.');
            }

            if (payload.data.authenticated) {
                button.textContent = 'Reprendre la session';
                button.disabled = false;
                button.addEventListener('click', function resumeSession() {
                    button.disabled = true;
                    button.classList.add('is-loading');
                    setStatus('Ouverture de votre espace…');
                    window.loadDesktopSession(payload.data.user);
                }, { once: true });
                return;
            }

            if (!payload.data.authentication.available) {
                button.disabled = true;
                setStatus("L'application Luma OS doit encore être déclarée dans Kyros.");
                return;
            }

            button.disabled = false;
            button.addEventListener('click', function beginLogin() {
                button.disabled = true;
                button.classList.add('is-loading');
                button.textContent = 'Connexion à Kyros…';
                setStatus('Redirection vers la connexion sécurisée.');
                window.location.assign('/auth/login');
            }, { once: true });
        } catch (error) {
            button.disabled = true;
            const unreachable = error instanceof TypeError;
            button.textContent = 'Serveur injoignable';
            if (unreachable) {
                setStatus('Impossible de joindre le serveur Luma. Soit le serveur web n’est pas lancé, soit votre connexion est coupée.');
            } else {
                setStatus('Le service de session est indisponible. Rechargez la page pour réessayer.');
            }
        }
    }

    if (query.has('auth_error')) {
        setStatus('La connexion Kyros n’a pas abouti. Vous pouvez réessayer.');
        window.history.replaceState({}, '', window.location.pathname);
    }

    readSession();
})();
