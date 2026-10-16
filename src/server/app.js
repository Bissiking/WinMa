// src/server/app.js
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { createSecurityMiddleware } = require('./config/security');
const { createDatabase, runMigrations } = require('./db');
const { createRepositories } = require('./repositories');
const { createSessionStore } = require('./stores/session-store');
const { createKyrosService } = require('./services/kyros-service');
const { createSessionService } = require('./services/session-service');
const { createAppRegistryService } = require('./services/app-registry-service');
const { createSettingsService } = require('./services/settings-service');
const { createAccountService } = require('./services/account-service');
const { createDocumentService } = require('./services/document-service');
const { createWindowSessionService } = require('./services/window-session-service');
const { createWorkspaceService } = require('./services/workspace-service');
const { createHarmonixService } = require('./services/harmonix-service');
const { createSonoraStudioService } = require('./services/sonora-studio-service');
const { createBrainDumpService } = require('./services/braindump-service');
const { createBackupService } = require('./services/backup-service');
const { createBuildVersionService, renderServiceWorker } = require('./services/build-version-service');
const { createNetworkService } = require('./services/network-service');
const { createSystemMetricsService } = require('./services/system-metrics-service');
const { createAuthController } = require('./controllers/auth-controller');
const { createSessionController } = require('./controllers/session-controller');
const { createWindowSessionController } = require('./controllers/window-session-controller');
const { createWorkspaceController } = require('./controllers/workspace-controller');
const { createAppsController } = require('./controllers/apps-controller');
const { createSettingsController } = require('./controllers/settings-controller');
const { createAccountController } = require('./controllers/account-controller');
const { createDocumentsController } = require('./controllers/documents-controller');
const { createHarmonixController } = require('./controllers/harmonix-controller');
const { createSonoraStudioController } = require('./controllers/sonora-studio-controller');
const { createBrainDumpController } = require('./controllers/braindump-controller');
const { createBackupController } = require('./controllers/backup-controller');
const { createAuthRoutes } = require('./routes/auth-routes');
const { createSessionRoutes } = require('./routes/session-routes');
const { createWindowSessionRoutes } = require('./routes/window-session-routes');
const { createWorkspaceRoutes } = require('./routes/workspace-routes');
const { createAppsRoutes } = require('./routes/apps-routes');
const { createSettingsRoutes } = require('./routes/settings-routes');
const { createAccountRoutes } = require('./routes/account-routes');
const { createDocumentsRoutes } = require('./routes/documents-routes');
const { createHarmonixRoutes } = require('./routes/harmonix-routes');
const { createSonoraStudioRoutes } = require('./routes/sonora-studio-routes');
const { createBrainDumpRoutes } = require('./routes/braindump-routes');
const { createBackupRoutes } = require('./routes/backup-routes');
const { createApiRoutes } = require('./routes/api');
const { createRequireSameOrigin } = require('./middlewares/require-same-origin');
const { createRequireSession } = require('./middlewares/require-session');
const { requestContext } = require('./middlewares/request-context');
const { notFound } = require('./middlewares/not-found');
const { errorHandler } = require('./middlewares/error-handler');
const logger = require('./utils/logger');

async function createApp({ config, fetchImplementation = globalThis.fetch, database = null, appRegistryPath = null } = {}) {
    if (!config) {
        throw new Error('La configuration serveur est requise.');
    }

    const app = express();
    const projectRoot = path.resolve(__dirname, '../..');
    const legacyPublicRoot = path.join(projectRoot, 'sources');
    const buildVersionService = createBuildVersionService({ projectRoot });

    // Base de données : SQLite (développement) ou PostgreSQL (production),
    // issues de DB_PROVIDER. Aucun repli silencieux en cas d'indisponibilité.
    const activeDatabase = database || await createDatabase(config.database);
    const migrationsDir = config.database?.migrationsDir;
    if (migrationsDir) {
        const migrationResult = await runMigrations(activeDatabase, { migrationsDir });
        if (migrationResult.applied.length) {
            logger.info('database_migrations_applied', {
                provider: migrationResult.provider,
                applied: migrationResult.applied
            });
        }
    }
    const repositories = createRepositories(activeDatabase);
    const sessionStore = createSessionStore(repositories.sessionStore);
    await sessionStore.prune();

    const isSqlite = activeDatabase.provider === 'sqlite';
    const appRegistryService = createAppRegistryService(
        appRegistryPath || path.join(projectRoot, 'data/apps.json')
    );
    const settingsService = createSettingsService({
        repository: repositories.settings,
        legacyDirectory: isSqlite ? path.join(projectRoot, 'data/settings') : null
    });
    const accountService = createAccountService({
        repository: repositories.account,
        legacyDirectory: isSqlite ? path.join(projectRoot, 'data/accounts') : null
    });
    const documentService = createDocumentService({
        repository: repositories.documents,
        storageRoot: path.join(projectRoot, 'storage/documents')
    });
    const windowSessionService = createWindowSessionService(repositories.windowSessions);
    const workspaceService = createWorkspaceService({
        workspaceRepository: repositories.workspaces,
        windowSessionService
    });
    const backupService = createBackupService({
        settingsService,
        accountService,
        windowSessionService,
        documentService,
        version: config.version
    });
    const harmonixService = createHarmonixService(config.harmonix, fetchImplementation);
    const sonoraStudioService = createSonoraStudioService(config.sonoraStudio || {
        baseUrl: 'http://localhost:6002', timeoutMs: 15000
    }, fetchImplementation);
    const brainDumpService = createBrainDumpService(config.brainDump || {
        baseUrl: 'https://note-orbis.mhemery.fr', timeoutMs: 10000
    }, fetchImplementation);
    const networkService = createNetworkService({ config, fetchImplementation });
    const systemMetricsService = createSystemMetricsService();
    const kyrosService = createKyrosService(config.kyros, fetchImplementation);
    const sessionService = createSessionService(kyrosService, {
        // Pull Kyros → Luma : à chaque login/refresh, les préférences locales
        // suivent le profil Kyros si la synchronisation est active.
        onAuthenticated: (req, claims) =>
            accountService.applyKyrosProfile(req.session.user.id, claims).catch(() => undefined)
    });
    const authController = createAuthController({ config, kyrosService, sessionService });
    const sessionController = createSessionController(sessionService, config, kyrosService);
    const windowSessionController = createWindowSessionController(windowSessionService);
    const workspaceController = createWorkspaceController(workspaceService);
    const appsController = createAppsController(appRegistryService);
    const settingsController = createSettingsController(settingsService);
    const accountController = createAccountController({
        accountService,
        settingsService,
        documentService,
        appRegistryService,
        kyrosService
    });
    const documentsController = createDocumentsController(documentService);
    const harmonixController = createHarmonixController(harmonixService);
    const sonoraStudioController = createSonoraStudioController(sonoraStudioService);
    const brainDumpController = createBrainDumpController(brainDumpService);
    const backupController = createBackupController(backupService);
    const requireSameOrigin = createRequireSameOrigin(config.appBaseUrl);
    const requireSession = createRequireSession(sessionService);

    app.disable('x-powered-by');
    if (config.isProduction) {
        app.set('trust proxy', 1);
    }

    app.use(requestContext);
    // CSP durcie : frame-src alimenté automatiquement par les origines déclarées
    // dans le registre (apps type iframe). Aucun script inline ni CDN externe.
    const allowedFrameOrigins = await appRegistryService.listAllowedFrameOrigins();
    app.use(createSecurityMiddleware(config, { allowedFrameOrigins }));
    app.use(express.json({ limit: '1mb', strict: true }));
    app.use(session({
        name: 'luma.sid',
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        store: sessionStore,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.isProduction,
            maxAge: config.sessionMaxAgeMs
        }
    }));

    app.use(createAuthRoutes(authController, requireSameOrigin));
    app.use(createSessionRoutes(sessionController, requireSession));
    app.use(createWindowSessionRoutes(windowSessionController, requireSession, requireSameOrigin));
    app.use(createWorkspaceRoutes(workspaceController, requireSession, requireSameOrigin));
    app.use(createAppsRoutes(appsController, requireSession));
    app.use(createSettingsRoutes(settingsController, requireSession, requireSameOrigin));
    app.use(createAccountRoutes(accountController, requireSession, requireSameOrigin));
    app.use(createBackupRoutes(backupController, requireSession, requireSameOrigin));
    app.use(createDocumentsRoutes(documentsController, requireSession, requireSameOrigin));
    app.use(createHarmonixRoutes(harmonixController));
    app.use(createSonoraStudioRoutes(sonoraStudioController, requireSession, requireSameOrigin));
    app.use(createBrainDumpRoutes(brainDumpController, requireSession, requireSameOrigin));
    app.use(createApiRoutes({ version: config.version, requireSession, networkService, buildVersionService, metricsService: systemMetricsService }));
    app.get('/sw.js', (req, res) => {
        let source;
        try {
            source = fs.readFileSync(path.join(legacyPublicRoot, 'sw.js'), 'utf8');
        } catch {
            res.status(404).type('text/plain').end();
            return;
        }
        res.set({
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0'
        });
        res.send(renderServiceWorker(source, buildVersionService.get()));
    });
    app.use(express.static(legacyPublicRoot, { index: false }));
    app.get('/', (req, res) => res.sendFile(path.join(projectRoot, 'index.html')));
    app.use(notFound);
    app.use(errorHandler);

    app.locals.database = activeDatabase;
    app.locals.repositories = repositories;

    return app;
}

module.exports = { createApp };
