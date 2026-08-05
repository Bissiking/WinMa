// src/server/app.js
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const createMemoryStore = require('memorystore');
const { createSecurityMiddleware } = require('./config/security');
const { createKyrosService } = require('./services/kyros-service');
const { createSessionService } = require('./services/session-service');
const { createAppRegistryService } = require('./services/app-registry-service');
const { createSettingsService } = require('./services/settings-service');
const { createAccountService } = require('./services/account-service');
const { createSqliteDocumentRepository } = require('./repositories/sqlite-document-repository');
const { createDocumentService } = require('./services/document-service');
const { createAuthController } = require('./controllers/auth-controller');
const { createSessionController } = require('./controllers/session-controller');
const { createAppsController } = require('./controllers/apps-controller');
const { createSettingsController } = require('./controllers/settings-controller');
const { createAccountController } = require('./controllers/account-controller');
const { createDocumentsController } = require('./controllers/documents-controller');
const { createAuthRoutes } = require('./routes/auth-routes');
const { createSessionRoutes } = require('./routes/session-routes');
const { createAppsRoutes } = require('./routes/apps-routes');
const { createSettingsRoutes } = require('./routes/settings-routes');
const { createAccountRoutes } = require('./routes/account-routes');
const { createDocumentsRoutes } = require('./routes/documents-routes');
const { createApiRoutes } = require('./routes/api');
const { createRequireSameOrigin } = require('./middlewares/require-same-origin');
const { createRequireSession } = require('./middlewares/require-session');
const { requestContext } = require('./middlewares/request-context');
const { notFound } = require('./middlewares/not-found');
const { errorHandler } = require('./middlewares/error-handler');

function createApp({ config, fetchImplementation = globalThis.fetch } = {}) {
    if (!config) {
        throw new Error('La configuration serveur est requise.');
    }

    const app = express();
    const MemoryStore = createMemoryStore(session);
    const projectRoot = path.resolve(__dirname, '../..');
    const legacyPublicRoot = path.join(projectRoot, 'sources');
    const appRegistryService = createAppRegistryService(path.join(projectRoot, 'data/apps.json'));
    const settingsService = createSettingsService(path.join(projectRoot, 'data/settings'));
    const accountService = createAccountService(path.join(projectRoot, 'data/accounts'));
    const documentRepository = createSqliteDocumentRepository(path.join(projectRoot, 'data/luma.sqlite'));
    const documentService = createDocumentService({
        repository: documentRepository,
        storageRoot: path.join(projectRoot, 'storage/documents')
    });
    const kyrosService = createKyrosService(config.kyros, fetchImplementation);
    const sessionService = createSessionService(kyrosService);
    const authController = createAuthController({ config, kyrosService, sessionService });
    const sessionController = createSessionController(sessionService, config);
    const appsController = createAppsController(appRegistryService);
    const settingsController = createSettingsController(settingsService);
    const accountController = createAccountController({
        accountService,
        settingsService,
        documentService,
        appRegistryService
    });
    const documentsController = createDocumentsController(documentService);
    const requireSameOrigin = createRequireSameOrigin(config.appBaseUrl);
    const requireSession = createRequireSession(sessionService);

    app.disable('x-powered-by');
    if (config.isProduction) {
        app.set('trust proxy', 1);
    }

    app.use(requestContext);
    app.use(createSecurityMiddleware(config));
    app.use(express.json({ limit: '32kb', strict: true }));
    app.use(session({
        name: 'luma.sid',
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        store: new MemoryStore({ checkPeriod: 60 * 60 * 1000 }),
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.isProduction,
            maxAge: config.sessionMaxAgeMs
        }
    }));

    app.use(createAuthRoutes(authController, requireSameOrigin));
    app.use(createSessionRoutes(sessionController));
    app.use(createAppsRoutes(appsController, requireSession));
    app.use(createSettingsRoutes(settingsController, requireSession, requireSameOrigin));
    app.use(createAccountRoutes(accountController, requireSession, requireSameOrigin));
    app.use(createDocumentsRoutes(documentsController, requireSession, requireSameOrigin));
    app.use(createApiRoutes());
    app.use(express.static(legacyPublicRoot, { index: false }));
    app.get('/', (req, res) => res.sendFile(path.join(projectRoot, 'index.html')));
    app.use(notFound);
    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
