// sources/assets/javascripts/all.js
(function initializeLumaShell() {
    const defaultWallpaper = './images/backgrounds/background-01.jpg';

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            headers: { accept: 'application/json', ...(options.headers || {}) },
            ...options
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'La requête a échoué.');
        }

        return payload.data;
    }

    async function CallPage(page) {
        try {
            const response = await fetch(`./apps/${page}/index.html`, { credentials: 'same-origin' });

            if (!response.ok) {
                throw new Error(`Page ${page} introuvable.`);
            }

            $('#desktop-apps').html(await response.text());
        } catch (error) {
            console.error('Impossible de charger la page :', error.message);
        }
    }

    async function loadDesktopSession(user) {
        $('#nameuser-menu-start-ico-user-name').text(user.displayName || user.username);

        try {
            const settings = await requestJson('/api/users/me/settings');
            document.body.style.backgroundImage = `url(${settings.wallpaper || defaultWallpaper})`;
            document.documentElement.dataset.theme = settings.theme;
            document.documentElement.style.setProperty('--luma-accent', settings.accentColor);
        } catch {
            document.body.style.backgroundImage = `url(${defaultWallpaper})`;
        }

        $('.start-menu').removeClass('hidden');
        await CallPage('desktop');
    }

    async function showSessionScreen() {
        $('.start-menu').addClass('hidden');
        $('.menu-start').css('bottom', '-1000px').data('menu-open', false);
        document.body.style.backgroundImage = 'url(./images/locked/locked-01.png)';
        await CallPage('session-select');
    }

    async function bootstrap() {
        try {
            const currentSession = await requestJson('/api/session');

            if (currentSession.authenticated) {
                await loadDesktopSession(currentSession.user);
            } else {
                await showSessionScreen();
            }
        } catch {
            await showSessionScreen();
        }
    }

    window.CallPage = CallPage;
    window.loadDesktopSession = loadDesktopSession;

    document.addEventListener('DOMContentLoaded', bootstrap);

    $('#btn-menu-start-power-option').on('click', function togglePowerMenu() {
        const menu = $('#menu-menu-start-power-option');
        menu.toggleClass('hidden');
        $(this).attr('aria-expanded', String(!menu.hasClass('hidden')));
    });

    $('#open-start-button').on('click', function toggleStartMenu() {
        const menu = $('.menu-start');
        const willOpen = menu.data('menu-open') !== true;
        menu.stop(true).animate({ bottom: willOpen ? 60 : -1000 }, 200);
        menu.data('menu-open', willOpen);
        $(this).attr('aria-expanded', String(willOpen));
    });

    $(document).on('click', '[data-session-action]', async function handleSessionAction() {
        const action = this.dataset.sessionAction;

        if (action === 'logout') {
            this.disabled = true;

            try {
                await requestJson('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                console.error('Déconnexion incomplète :', error.message);
            }

            $('#nameuser-menu-start-ico-user-name').text('Aucun utilisateur');
        }

        await showSessionScreen();
    });
})();
