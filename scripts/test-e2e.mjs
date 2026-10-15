// scripts/test-e2e.mjs
// Lance la recette navigateur (tests/e2e) avec le drapeau LUMA_E2E=1, sans
// dépendre de la syntaxe d'environnement du shell hôte (cmd, PowerShell, sh).
import { spawn } from 'node:child_process';

// Liste explicite des suites E2E (node --test n'expand pas les répertoires de
// façon fiable sur tous les hôtes) : ajoutez un fichier ici s'il en crée un.
const child = spawn(process.execPath, [
    '--test',
    'tests/e2e/shell.e2e.test.js',
    'tests/e2e/apps.e2e.test.js',
    'tests/e2e/lock.e2e.test.js',
    'tests/e2e/backup.e2e.test.js'
], {
    stdio: 'inherit',
    env: { ...process.env, LUMA_E2E: '1' }
});

child.on('exit', (code, signal) => {
    process.exit(signal ? 1 : (code ?? 1));
});
