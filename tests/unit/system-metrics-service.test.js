// tests/unit/system-metrics-service.test.js
// Moteur de supervision du Gestionnaire des tâches : les limites effectives
// du périmètre (conteneur/LXC via cgroups) priment toujours sur les valeurs
// host, et une métrique non fiable est « indisponible » (null) — jamais
// déduite de l'hôte.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSystemMetricsService } = require('../../src/server/services/system-metrics-service');

const GIB = 1024 ** 3;
const HOST_TOTALMEM = 151323863040; // 141 Gio, l'hôte Proxmox du bug rapporté

function createFakeFs(files) {
    const store = new Map(Object.entries(files).map(([key, value]) => [normalize(key), value]));
    function normalize(target) {
        const slashed = String(target).replace(/\\/g, '/');
        return slashed.length > 1 && slashed.endsWith('/') ? slashed.slice(0, -1) : slashed;
    }
    return {
        store,
        readFileSync(target) {
            const value = store.get(normalize(target));
            if (value === undefined) throw Object.assign(new Error(`ENOENT: ${target}`), { code: 'ENOENT' });
            return value;
        },
        existsSync(target) {
            return store.has(normalize(target));
        }
    };
}

function createFakeOs({ cores = 16, cpuSequence = [{ idle: 900, user: 100 }, { idle: 950, user: 1050 }], totalmem = HOST_TOTALMEM, freemem = 75563771904, loadavg = [8.25, 7.5, 6.1] } = {}) {
    let call = 0;
    return {
        cpus: () => {
            const times = cpuSequence[Math.min(call, cpuSequence.length - 1)];
            call += 1;
            // Les champs de `times` sont cumulés par le service (pas de clé
            // `total` : node:os ne l'expose pas, il est déduit de la somme).
            return Array.from({ length: cores }, () => ({ times: { user: 0, nice: 0, sys: 0, irq: 0, ...times } }));
        },
        totalmem: () => totalmem,
        freemem: () => freemem,
        loadavg: () => loadavg
    };
}

function createService({ files = {}, probeRoot = null, env = {}, time = { value: 0 }, osOverrides = {} } = {}) {
    const fakeFs = createFakeFs(files);
    const service = createSystemMetricsService({
        platform: 'linux',
        env,
        fs: fakeFs,
        os: createFakeOs(osOverrides),
        probeRoot,
        now: () => time.value
    });
    return { service, fakeFs };
}

test('les limites cgroups du conteneur priment sur les valeurs host (Docker dans un LXC)', () => {
    const files = {
        '/.dockerenv': '',
        '/proc/self/cgroup': '0::/\n',
        '/sys/fs/cgroup/cgroup.controllers': 'cpu memory\n',
        '/sys/fs/cgroup/cpu.max': '200000 100000\n',
        '/sys/fs/cgroup/memory.max': String(2 * GIB),
        '/sys/fs/cgroup/memory.current': '536870912\n',
        '/sys/fs/cgroup/cpu.stat': 'usage_usec 1000000\nuser_usec 900000\n'
    };
    const time = { value: 0 };
    const { service, fakeFs } = createService({ files, time });

    const first = service.snapshot();
    assert.equal(first.meta.scope, 'container');
    assert.equal(first.meta.containerized, true);
    assert.equal(first.cpu.logicalCores, 2, '2 vCPU du conteneur, jamais les 16 de l\u2019hôte');
    assert.notEqual(first.cpu.logicalCores, 16);
    assert.equal(first.memory.totalBytes, 2 * GIB, '2 Gio du conteneur, jamais les 141 Gio de l\u2019hôte');
    assert.notEqual(first.memory.totalBytes, HOST_TOTALMEM);
    assert.equal(first.memory.usedBytes, 536870912);
    assert.equal(first.memory.availableBytes, 2 * GIB - 536870912);
    assert.equal(first.memory.percent, 25);
    assert.equal(first.cpu.loadAverage, null, 'la charge hôte n\u2019est jamais présentée comme celle du conteneur');
    assert.equal(first.cpu.percent, null, 'amorçage de la série : pas de pourcentage inventé au premier relevé');
    assert.deepEqual(first.meta.sources, {
        percent: 'unavailable', cores: 'cgroup-v2', memory: 'cgroup-v2', loadAverage: 'unavailable'
    });

    fakeFs.store.set('/sys/fs/cgroup/cpu.stat', 'usage_usec 3000000\n');
    time.value = 2000;
    const second = service.snapshot();
    // 2 s de temps CPU sur 2 s réelles = 100 % d\u2019un cœur, normalisé par 2 cœurs = 50 %.
    assert.equal(second.cpu.percent, 50);
    assert.equal(second.meta.sources.percent, 'cgroup-v2');
});

test('les limites des ancêtres cgroups s\u2019appliquent (Docker dans LXC, cgroup ns host)', () => {
    const files = {
        '/.dockerenv': '',
        '/proc/self/cgroup': '0::/lxc/105/docker-abc123\n',
        '/sys/fs/cgroup/cgroup.controllers': 'cpu memory\n',
        '/sys/fs/cgroup/cpu.max': 'max 100000\n',
        '/sys/fs/cgroup/memory.max': 'max\n',
        '/sys/fs/cgroup/lxc/cgroup.controllers': 'cpu memory\n',
        '/sys/fs/cgroup/lxc/cpu.max': 'max 100000\n',
        '/sys/fs/cgroup/lxc/memory.max': 'max\n',
        '/sys/fs/cgroup/lxc/105/cgroup.controllers': 'cpu memory\n',
        '/sys/fs/cgroup/lxc/105/cpu.max': '200000 100000\n',
        '/sys/fs/cgroup/lxc/105/memory.max': String(2 * GIB),
        '/sys/fs/cgroup/lxc/105/docker-abc123/cgroup.controllers': 'cpu memory\n',
        '/sys/fs/cgroup/lxc/105/docker-abc123/cpu.max': 'max 100000\n',
        '/sys/fs/cgroup/lxc/105/docker-abc123/memory.max': 'max\n',
        '/sys/fs/cgroup/lxc/105/docker-abc123/memory.current': String(GIB),
        '/sys/fs/cgroup/lxc/105/docker-abc123/cpu.stat': 'usage_usec 0\n'
    };
    const { service } = createService({ files });

    const metrics = service.snapshot();
    assert.equal(metrics.meta.scope, 'container');
    assert.equal(metrics.cpu.logicalCores, 2, 'limite du cgroup LXC parent, pas du conteneur ni de l\u2019hôte');
    assert.equal(metrics.memory.totalBytes, 2 * GIB);
    assert.equal(metrics.memory.usedBytes, GIB, 'consommation au niveau de la feuille (conteneur)');
    assert.equal(metrics.memory.percent, 50);
});

test('sans limite lisible en conteneur, les métriques sont indisponibles — jamais host', () => {
    const files = {
        '/.dockerenv': '',
        '/proc/self/cgroup': '0::/\n',
        '/sys/fs/cgroup/cgroup.controllers': 'cpu memory\n',
        '/sys/fs/cgroup/cpu.max': 'max 100000\n',
        '/sys/fs/cgroup/memory.max': 'max\n',
        '/sys/fs/cgroup/memory.current': '268435456\n',
        '/sys/fs/cgroup/cpu.stat': 'usage_usec 100\n'
    };
    const { service } = createService({ files });

    const metrics = service.snapshot();
    assert.equal(metrics.cpu.logicalCores, null, 'pas de nombre de cœurs deviné depuis l\u2019hôte');
    assert.notEqual(metrics.cpu.logicalCores, 16);
    assert.equal(metrics.memory.totalBytes, null, 'pas de total mémoire host présenté comme conteneur');
    assert.notEqual(metrics.memory.totalBytes, HOST_TOTALMEM);
    assert.equal(metrics.memory.usedBytes, 268435456, 'la consommation du conteneur reste fiable');
    assert.equal(metrics.memory.percent, null);
    assert.equal(metrics.cpu.percent, null);
    assert.equal(metrics.cpu.loadAverage, null);
    assert.deepEqual(metrics.meta.sources, {
        percent: 'unavailable', cores: 'unavailable', memory: 'cgroup-v2', loadAverage: 'unavailable'
    });
});

test('sur une machine native, les valeurs node:os restent la référence', () => {
    const files = {
        '/proc/self/cgroup': '0::/user.slice/user-1000.slice/session-3.scope\n'
    };
    const { service } = createService({ files });

    const metrics = service.snapshot();
    assert.equal(metrics.meta.scope, 'host');
    assert.equal(metrics.meta.containerized, false);
    assert.equal(metrics.cpu.logicalCores, 16);
    assert.equal(metrics.memory.totalBytes, HOST_TOTALMEM);
    assert.equal(metrics.memory.percent, 50.1, 'totalmem - freemem sur totalmem');
    assert.equal(metrics.cpu.percent, 95, 'delta node:os historique inchangé (950/1000 busy)');
    assert.deepEqual(metrics.cpu.loadAverage, [8.25, 7.5, 6.1]);
    assert.deepEqual(metrics.meta.sources, {
        percent: 'host-os', cores: 'host-os', memory: 'host-os', loadAverage: 'host-os'
    });
});

test('le collecteur lecture seule vise une racine machine externe (LXC parent)', () => {
    // Valeurs live host TRAÎNANTES : elles ne doivent jamais gagner.
    const files = {
        '/.dockerenv': '',
        '/proc/self/cgroup': '0::/\n',
        '/sys/fs/cgroup/cgroup.controllers': 'cpu memory\n',
        '/sys/fs/cgroup/cpu.max': 'max 100000\n',
        '/sys/fs/cgroup/memory.max': 'max\n',
        '/collector/sys/fs/cgroup': '',
        '/collector/sys/fs/cgroup/cgroup.controllers': 'cpu memory\n',
        '/collector/sys/fs/cgroup/cpu.max': '400000 100000\n',
        '/collector/sys/fs/cgroup/memory.max': String(4 * GIB),
        '/collector/sys/fs/cgroup/memory.current': String(GIB),
        '/collector/sys/fs/cgroup/cpu.stat': 'usage_usec 1000000\n',
        '/collector/proc/self/cgroup': '0::/\n'
    };
    const time = { value: 0 };
    const { service, fakeFs } = createService({ files, probeRoot: '/collector', time });

    const first = service.snapshot();
    assert.equal(first.meta.scope, 'probe');
    assert.equal(first.meta.probe, true);
    assert.equal(first.cpu.logicalCores, 4);
    assert.equal(first.memory.totalBytes, 4 * GIB);
    assert.notEqual(first.memory.totalBytes, HOST_TOTALMEM);
    assert.equal(first.memory.usedBytes, GIB);
    assert.equal(first.cpu.loadAverage, null, 'pas de charge fiable hors machine native');

    fakeFs.store.set('/collector/sys/fs/cgroup/cpu.stat', 'usage_usec 3000000\n');
    time.value = 1000;
    const second = service.snapshot();
    // 2 s de CPU sur 1 s réelle = 200 % d\u2019un cœur, / 4 cœurs = 50 %.
    assert.equal(second.cpu.percent, 50);
});

test('le collecteur accepte aussi un dossier cgroup monté en lecture seule', () => {
    const files = {
        '/lxc-cgroup/cpu.max': '200000 100000\n',
        '/lxc-cgroup/memory.max': String(2 * GIB),
        '/lxc-cgroup/memory.current': '536870912\n'
    };
    const { service } = createService({ files, probeRoot: '/lxc-cgroup' });

    const metrics = service.snapshot();
    assert.equal(metrics.meta.scope, 'probe');
    assert.equal(metrics.cpu.logicalCores, 2);
    assert.equal(metrics.memory.totalBytes, 2 * GIB);
    assert.equal(metrics.memory.usedBytes, 536870912);
});

test('le repli cgroups v1 reste supporté (quota, limite et cpuacct)', () => {
    const files = {
        '/run/.containerenv': '',
        '/proc/self/cgroup': '2:cpu,cpuacct:/\n4:memory:/\n',
        '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_quota_us': '150000\n',
        '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_period_us': '100000\n',
        '/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage': '2000000000\n',
        '/sys/fs/cgroup/memory/memory.limit_in_bytes': String(GIB),
        '/sys/fs/cgroup/memory/memory.usage_in_bytes': '268435456\n'
    };
    const time = { value: 0 };
    const { service, fakeFs } = createService({ files, time });

    const first = service.snapshot();
    assert.equal(first.meta.scope, 'container');
    assert.equal(first.cpu.logicalCores, 1.5);
    assert.equal(first.memory.totalBytes, GIB);
    assert.equal(first.memory.usedBytes, 268435456);
    assert.equal(first.memory.percent, 25);
    assert.equal(first.meta.sources.cores, 'cgroup-v1');

    fakeFs.store.set('/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage', '2750000000\n');
    time.value = 1000;
    const second = service.snapshot();
    // 750 ms de CPU sur 1 s réelle = 75 % d\u2019un cœur, / 1,5 cœur = 50 %.
    assert.equal(second.cpu.percent, 50);
    assert.equal(second.meta.sources.percent, 'cgroup-v1');
});

test('LUMA_METRICS_SCOPE=host force le périmètre (débogage opérateur)', () => {
    const files = {
        '/.dockerenv': '',
        '/proc/self/cgroup': '0::/\n',
        '/sys/fs/cgroup/cgroup.controllers': 'cpu memory\n',
        '/sys/fs/cgroup/cpu.max': '200000 100000\n',
        '/sys/fs/cgroup/memory.max': String(2 * GIB)
    };
    const { service } = createService({ files, env: { LUMA_METRICS_SCOPE: 'host' } });

    const metrics = service.snapshot();
    assert.equal(metrics.meta.scope, 'host');
    assert.equal(metrics.cpu.logicalCores, 16, 'override explicite : valeurs host assumées');
    assert.equal(metrics.memory.totalBytes, HOST_TOTALMEM);
});
