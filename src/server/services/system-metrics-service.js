// src/server/services/system-metrics-service.js
//
// Moteur de supervision du Gestionnaire des tâches.
//
// Règle fondamentale : ne JAMAIS présenter les métriques de l'hôte comme
// celles du périmètre d'exécution. Quand le processus tourne dans un
// conteneur (Docker) ou dans une machine virtuelle/conteneur système (LXC),
// les valeurs host d'`node:os` décrivent la mauvaise machine — le serveur
// doit alors se fier aux cgroups (limites effectives CPU/RAM) et déclarer
// « indisponible » (null) ce qui n'est pas lisible, plutôt que de deviner.
//
// Environnements couverts :
//   - machine native (Linux sans marqueur de conteneur, macOS, Windows) :
//     valeurs `node:os` classiques, inchangées ;
//   - conteneur Docker / LXC : limites effectives via cgroups v2 puis v1,
//     en remontant les ancêtres jusqu'à la limite la plus contraignante
//     (utile quand cgroup ns = host : le cgroup du LXC parent est visible) ;
//   - collecteur lecture seule (`LUMA_METRICS_PROBE_ROOT`) : pointe vers une
//     vue externe du périmètre réel — un dossier cgroup monté en lecture
//     seule (ex. le cgroup du LXC parent) ou la racine d'une machine dont
//     `sys/fs/cgroup` et `proc/self/cgroup` sont exposés. Aucun accès
//     privilégié à Docker ni à Proxmox n'est requis : lecture de fichiers
//     uniquement.
//
// Variables d'environnement :
//   - LUMA_METRICS_PROBE_ROOT : chemin du collecteur lecture seule ;
//   - LUMA_METRICS_SCOPE      : `host` | `container` — force le périmètre
//                               (débogage/explicitation, auto par défaut) ;
//   - LUMA_IN_CONTAINER       : `1` — force le détection de conteneur.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const logger = require('../utils/logger');

// Les valeurs sentinelle des cgroups v1 (« pas de limite ») s'expriment en
// ~2^63 : au-delà de 2^62 o, on considère qu'aucune limite n'est posée.
const UNLIMITED_BYTES = 2 ** 62;
const MAX_ANCESTOR_WALK = 32;
const CONTAINER_MARKERS = /(docker|containerd|kubepods|libpod|lxc)/;

function parseSelfCgroup(content) {
    const parsed = { v2Path: null, v1Cpu: null, v1Memory: null };
    if (!content) return parsed;
    for (const line of content.split('\n')) {
        const parts = line.split(':');
        if (parts.length < 3) continue;
        const controllers = parts[1];
        const cgPath = parts[2] || '/';
        if (controllers === '') { parsed.v2Path = cgPath; continue; }
        const list = controllers.split(',');
        if (list.includes('cpu') && !parsed.v1Cpu) parsed.v1Cpu = { controllers, path: cgPath };
        if (list.includes('memory') && !parsed.v1Memory) parsed.v1Memory = { controllers, path: cgPath };
    }
    return parsed;
}

function parseCpuMax(content) {
    if (content == null) return null;
    const [quotaRaw, periodRaw] = content.trim().split(/\s+/);
    if (!quotaRaw) return null;
    const period = Number(periodRaw) > 0 ? Number(periodRaw) : 100000;
    if (quotaRaw === 'max') return { quota: null, period };
    const quota = Number(quotaRaw);
    if (!Number.isFinite(quota) || quota <= 0) return { quota: null, period };
    return { quota, period };
}

function parseBytes(content) {
    if (content == null) return null;
    const value = Number(content.trim());
    if (!Number.isFinite(value) || value <= 0 || value >= UNLIMITED_BYTES) return null;
    return Math.floor(value);
}

function parseUsageUsec(content) {
    if (content == null) return null;
    for (const line of content.split('\n')) {
        const [key, value] = line.trim().split(/\s+/);
        if (key === 'usage_usec') {
            const usec = Number(value);
            return Number.isFinite(usec) && usec >= 0 ? usec : null;
        }
    }
    return null;
}

function parseUsageNsecToUsec(content) {
    if (content == null) return null;
    const nsec = Number(content.trim());
    if (!Number.isFinite(nsec) || nsec < 0) return null;
    return Math.floor(nsec / 1000);
}

function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function clampPercent(value) {
    return round(Math.min(100, Math.max(0, value)), 1);
}

function createSystemMetricsService({
    fs: fileSystem = fs,
    os: osModule = os,
    env = process.env,
    platform = process.platform,
    now = Date.now,
    probeRoot = undefined
} = {}) {
    const resolvedProbeRoot = probeRoot === undefined
        ? (env.LUMA_METRICS_PROBE_ROOT || null)
        : (probeRoot || null);

    if (resolvedProbeRoot) {
        const probeReadable = pathExists(resolvedProbeRoot)
            || pathExists(path.join(resolvedProbeRoot, 'sys', 'fs', 'cgroup'))
            || pathExists(path.join(resolvedProbeRoot, 'cpu.max'))
            || pathExists(path.join(resolvedProbeRoot, 'cpu.cfs_quota_us'));
        if (!probeReadable) {
            logger.info('system_metrics_probe_unreadable', { probeRoot: resolvedProbeRoot });
        }
    }

    function readText(filePath) {
        try { return fileSystem.readFileSync(filePath, 'utf8'); } catch { return null; }
    }

    function pathExists(target) {
        try { return fileSystem.existsSync(target); } catch { return false; }
    }

    function readCpuTimes() {
        return osModule.cpus().reduce((summary, cpu) => {
            const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
            return { idle: summary.idle + cpu.times.idle, total: summary.total + total };
        }, { idle: 0, total: 0 });
    }

    // Amorçage des séries temporelles : les premiers deltas sont ensuite
    // calculés par rapport au démarrage du serveur (comportement historique).
    let previousCpuTimes = readCpuTimes();
    let previousUsage = null;

    function takeUsageSample(usageUsec, atMs) {
        if (usageUsec == null) { previousUsage = null; return null; }
        if (previousUsage == null || atMs <= previousUsage.atMs || usageUsec < previousUsage.usec) {
            previousUsage = { usec: usageUsec, atMs };
            return null;
        }
        const sample = { deltaUsec: usageUsec - previousUsage.usec, elapsedMs: atMs - previousUsage.atMs };
        previousUsage = { usec: usageUsec, atMs };
        return sample.elapsedMs > 0 && sample.deltaUsec >= 0 ? sample : null;
    }

    function resolveCgroupView() {
        if (resolvedProbeRoot) {
            const root = resolvedProbeRoot;
            if (pathExists(path.join(root, 'cpu.max')) || pathExists(path.join(root, 'cgroup.controllers'))) {
                return { version: 2, dir: root };
            }
            if (pathExists(path.join(root, 'cpu.cfs_quota_us')) || pathExists(path.join(root, 'memory.limit_in_bytes'))) {
                return { version: 1, cpuDir: root, memDir: root };
            }
            const mount = path.join(root, 'sys', 'fs', 'cgroup');
            if (pathExists(mount)) {
                return viewFromTree(mount, path.join(root, 'proc', 'self', 'cgroup'));
            }
            return null;
        }

        if (platform !== 'linux') return null;
        const mount = '/sys/fs/cgroup';
        return viewFromTree(mount, '/proc/self/cgroup');
    }

    function viewFromTree(mount, selfCgroupFile) {
        const parsed = parseSelfCgroup(readText(selfCgroupFile));
        if (parsed.v2Path != null) {
            const dir = path.join(mount, parsed.v2Path);
            if (pathExists(path.join(dir, 'cgroup.controllers')) || pathExists(path.join(dir, 'cpu.max'))) {
                return { version: 2, dir };
            }
        }
        if (parsed.v1Cpu || parsed.v1Memory) {
            return {
                version: 1,
                cpuDir: parsed.v1Cpu ? path.join(mount, parsed.v1Cpu.controllers, parsed.v1Cpu.path) : null,
                memDir: parsed.v1Memory ? path.join(mount, parsed.v1Memory.controllers, parsed.v1Memory.path) : null
            };
        }
        return parsed.v2Path != null ? { version: 2, dir: path.join(mount, parsed.v2Path) } : null;
    }

    function walkV2Limits(startDir) {
        let cores = null;
        let memoryBytes = null;
        let current = startDir;
        for (let depth = 0; current && depth < MAX_ANCESTOR_WALK; depth += 1) {
            const cpuMax = parseCpuMax(readText(path.join(current, 'cpu.max')));
            if (cpuMax && cpuMax.quota != null) {
                const value = cpuMax.quota / cpuMax.period;
                cores = cores == null ? value : Math.min(cores, value);
            }
            const memory = parseBytes(readText(path.join(current, 'memory.max')));
            if (memory != null) memoryBytes = memoryBytes == null ? memory : Math.min(memoryBytes, memory);
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
        return { cores, memoryBytes };
    }

    function walkV1Limits(startDir, { kind }) {
        let cores = null;
        let memoryBytes = null;
        let current = startDir;
        for (let depth = 0; current && depth < MAX_ANCESTOR_WALK; depth += 1) {
            if (kind === 'cpu') {
                const quota = parseBytes(readText(path.join(current, 'cpu.cfs_quota_us')));
                const period = parseBytes(readText(path.join(current, 'cpu.cfs_period_us')));
                if (quota != null && period != null) {
                    const value = quota / period;
                    cores = cores == null ? value : Math.min(cores, value);
                }
            } else {
                const limit = parseBytes(readText(path.join(current, 'memory.limit_in_bytes')));
                if (limit != null) memoryBytes = memoryBytes == null ? limit : Math.min(memoryBytes, limit);
            }
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
        return { cores, memoryBytes };
    }

    function readUsage(view) {
        if (view.version === 2) {
            return {
                usageUsec: parseUsageUsec(readText(path.join(view.dir, 'cpu.stat'))),
                usedBytes: parseBytes(readText(path.join(view.dir, 'memory.current')))
            };
        }
        const usageUsec = view.cpuDir
            ? parseUsageNsecToUsec(readText(path.join(view.cpuDir, 'cpuacct.usage')))
            : null;
        const usedBytes = view.memDir
            ? parseBytes(readText(path.join(view.memDir, 'memory.usage_in_bytes')))
            : null;
        return { usageUsec, usedBytes };
    }

    function resolveScope() {
        const forced = String(env.LUMA_METRICS_SCOPE || '').toLowerCase();
        if (forced === 'host') return 'host';
        if (forced === 'container') return 'container';
        if (resolvedProbeRoot) return 'probe';
        if (platform !== 'linux') return 'host';
        if (env.LUMA_IN_CONTAINER === '1') return 'container';
        if (pathExists('/.dockerenv') || pathExists('/run/.containerenv')) return 'container';
        const selfCgroup = readText('/proc/self/cgroup');
        if (selfCgroup && CONTAINER_MARKERS.test(selfCgroup)) return 'container';
        return 'host';
    }

    function snapshot() {
        const scope = resolveScope();
        const scoped = scope !== 'host';
        const timestampMs = now();

        let view = null;
        let cgroupCores = null;
        let cgroupMemory = null;
        let usage = { usageUsec: null, usedBytes: null };
        let cgroupSource = null;
        try {
            view = resolveCgroupView();
        } catch {
            view = null;
        }
        if (view) {
            cgroupSource = view.version === 2 ? 'cgroup-v2' : 'cgroup-v1';
            const limits = view.version === 2
                ? walkV2Limits(view.dir)
                : {
                    cores: view.cpuDir ? walkV1Limits(view.cpuDir, { kind: 'cpu' }).cores : null,
                    memoryBytes: view.memDir ? walkV1Limits(view.memDir, { kind: 'memory' }).memoryBytes : null
                };
            cgroupCores = limits.cores;
            cgroupMemory = limits.memoryBytes;
            usage = readUsage(view);
        }

        let logicalCores = null;
        let coresSource = 'unavailable';
        let totalBytes = null;
        let usedBytes = null;
        let availableBytes = null;
        let memoryPercent = null;
        let memorySource = 'unavailable';
        let cpuPercent = null;
        let percentSource = 'unavailable';
        let loadAverage = null;
        let loadSource = 'unavailable';

        if (!scoped) {
            // Machine native : l'hôte EST le périmètre, valeurs `node:os`.
            logicalCores = Math.max(1, osModule.cpus().length);
            coresSource = 'host-os';
            totalBytes = osModule.totalmem();
            const freeBytes = osModule.freemem();
            usedBytes = Math.max(0, totalBytes - freeBytes);
            availableBytes = Math.max(0, Math.min(totalBytes, freeBytes));
            memoryPercent = clampPercent(usedBytes / totalBytes * 100);
            memorySource = 'host-os';
            const times = readCpuTimes();
            const idleDelta = times.idle - previousCpuTimes.idle;
            const totalDelta = times.total - previousCpuTimes.total;
            previousCpuTimes = times;
            cpuPercent = totalDelta > 0 ? clampPercent((1 - idleDelta / totalDelta) * 100) : 0;
            percentSource = 'host-os';
            loadAverage = osModule.loadavg().map((value) => round(value, 2));
            loadSource = 'host-os';
        } else if (view) {
            // Conteneur / collecteur : uniquement les cgroups du périmètre.
            if (cgroupCores != null) {
                logicalCores = cgroupCores;
                coresSource = cgroupSource;
            }
            if (cgroupMemory != null) {
                totalBytes = cgroupMemory;
                memorySource = cgroupSource;
                if (usage.usedBytes != null) {
                    usedBytes = Math.min(usage.usedBytes, totalBytes);
                    availableBytes = Math.max(0, totalBytes - usedBytes);
                    memoryPercent = clampPercent(usedBytes / totalBytes * 100);
                }
            } else if (usage.usedBytes != null) {
                usedBytes = usage.usedBytes;
                memorySource = cgroupSource;
            }
            if (logicalCores != null && usage.usageUsec != null) {
                const sample = takeUsageSample(usage.usageUsec, timestampMs);
                if (sample) {
                    cpuPercent = clampPercent(sample.deltaUsec / (sample.elapsedMs * 1000) / logicalCores * 100);
                    percentSource = cgroupSource;
                }
            }
            // La charge système (1/5/15 min) n'existe pas au niveau cgroup et
            // `/proc/loadavg` reflète toujours le noyau hôte : indisponible.
        }

        return {
            timestamp: new Date(timestampMs).toISOString(),
            cpu: { percent: cpuPercent, logicalCores, loadAverage },
            memory: { totalBytes, usedBytes, availableBytes, percent: memoryPercent },
            runtime: {
                uptimeSeconds: Math.round(process.uptime()),
                processMemoryBytes: process.memoryUsage().rss
            },
            meta: {
                scope,
                containerized: scope !== 'host',
                probe: Boolean(resolvedProbeRoot),
                sources: { percent: percentSource, cores: coresSource, memory: memorySource, loadAverage: loadSource }
            }
        };
    }

    return { snapshot };
}

module.exports = { createSystemMetricsService };
