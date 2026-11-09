/**
 * Architectural boundary rules (ADR-001, ADR-002, spec §1/§11/§19 AP-01).
 * Consumed by `pnpm arch` and by packages/testing (negative tests prove the rules fire).
 */

// ADR-002 level table. A module at level k may import only modules at level < k.
const MODULE_LEVELS = {
  identity: 1,
  catalog: 1,
  audit: 1,
  organization: 2,
  event: 3,
  participation: 4,
  assignment: 5,
  results: 6,
  standings: 7,
  tournament: 8,
};

const FRAMEWORKS =
  '(@nestjs|@prisma|prisma|@clerk|next|react|react-dom|express|pg|@aws-sdk|aws-sdk|@google-cloud|@azure)';
const nodeModule = (names) => `(^|/)node_modules/${names}(/|$)`;
const MODULE_ENTRY = '^packages/modules/[^/]+/(src|dist)/index\\.(ts|js|d\\.ts)$';
const DOMAIN = '^packages/(modules/[^/]+/src/domain|shared-kernel/src)/';

const levelRules = Object.entries(MODULE_LEVELS).map(([name, level]) => {
  const forbidden = Object.entries(MODULE_LEVELS)
    .filter(([other, l]) => other !== name && l >= level)
    .map(([other]) => other);
  return {
    name: `layer-${name}-no-same-or-higher-level`,
    comment: `ADR-002: ${name} (L${level}) must not depend on same-level or higher-level modules.`,
    severity: 'error',
    from: { path: `^packages/modules/${name}/` },
    to: { path: `^packages/(modules/(${forbidden.join('|')})|orchestration)/` },
  };
});

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'ADR-002: the module graph is acyclic.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-framework-free',
      comment:
        'ARCH-DOM-001 / AP-01: domain code must not import NestJS, Prisma, Clerk, Next.js, React, HTTP, or cloud SDKs.',
      severity: 'error',
      from: { path: DOMAIN },
      to: { path: nodeModule(FRAMEWORKS) },
    },
    {
      name: 'domain-no-node-io',
      comment: 'Domain code is pure: no HTTP, network, filesystem or process APIs.',
      severity: 'error',
      from: { path: DOMAIN },
      to: {
        dependencyTypes: ['core'],
        path: '^(node:)?(http|https|http2|net|dgram|dns|tls|fs|fs/promises|child_process|cluster|worker_threads)$',
      },
    },
    {
      name: 'domain-no-outer-layers',
      comment: 'Domain must not depend on application, contract or infrastructure code.',
      severity: 'error',
      from: { path: '^packages/modules/[^/]+/src/domain/' },
      to: { path: '^packages/modules/[^/]+/src/(application|contract|infrastructure)/' },
    },
    {
      name: 'application-no-infrastructure',
      comment: 'Application depends on ports, never on infrastructure.',
      severity: 'error',
      from: { path: '^packages/modules/[^/]+/src/application/' },
      to: { path: '^packages/modules/[^/]+/src/infrastructure/' },
    },
    {
      name: 'contract-is-leaf',
      comment: 'Module contract may only depend on shared-kernel and itself.',
      severity: 'error',
      from: { path: '^packages/modules/[^/]+/src/contract/' },
      to: { path: '^packages/modules/[^/]+/src/(domain|application|infrastructure)/' },
    },
    {
      name: 'prisma-only-in-infrastructure',
      comment: 'ADR-001: Prisma is allowed only in module infrastructure and packages/platform.',
      severity: 'error',
      from: { pathNot: '^packages/(modules/[^/]+/src/infrastructure|platform)/' },
      to: { path: nodeModule('(@prisma|prisma)') },
    },
    {
      name: 'clerk-only-in-infrastructure',
      comment: 'Clerk is limited to authentication adapters in infrastructure.',
      severity: 'error',
      from: { pathNot: '^packages/modules/[^/]+/src/infrastructure/' },
      to: { path: nodeModule('@clerk') },
    },
    {
      name: 'nestjs-only-in-api',
      comment: 'ADR-001: NestJS lives only in apps/api.',
      severity: 'error',
      from: { pathNot: '^apps/api/' },
      to: { path: nodeModule('@nestjs') },
    },
    {
      name: 'web-only-via-openapi',
      comment:
        'ADR-001/002: apps/web consumes only the OpenAPI contract; no DB, backend, or module code.',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: {
        path: [
          '^apps/api/',
          '^packages/(modules|orchestration|platform|shared-kernel)/',
          nodeModule('(@prisma|prisma|pg|@nestjs)'),
        ],
      },
    },
    {
      name: 'module-internals-private-cross-module',
      comment: 'ADR-001: modules import other modules only through their index (contract).',
      severity: 'error',
      from: { path: '^packages/modules/([^/]+)/' },
      to: { path: '^packages/modules/[^/]+/', pathNot: ['^packages/modules/$1/', MODULE_ENTRY] },
    },
    {
      name: 'module-internals-private-outside',
      comment: 'ADR-001: apps and packages import a module only through its index.',
      severity: 'error',
      from: { pathNot: '^packages/modules/' },
      to: { path: '^packages/modules/', pathNot: MODULE_ENTRY },
    },
    {
      name: 'foundation-no-upward-import',
      comment: 'ADR-002: shared-kernel and platform (L0) cannot import modules or orchestration.',
      severity: 'error',
      from: { path: '^packages/(shared-kernel|platform)/' },
      to: { path: '^packages/(modules|orchestration)/' },
    },
    {
      name: 'modules-no-orchestration',
      comment: 'ADR-002: orchestration (L9) sits above modules.',
      severity: 'error',
      from: { path: '^packages/modules/' },
      to: { path: '^packages/orchestration/' },
    },
    ...levelRules,
  ],
  options: {
    doNotFollow: { path: '(^|/)(node_modules|dist|\\.next)/' },
    exclude: {
      path: '(^|/)(\\.next|\\.turbo|generated)/|\\.test\\.tsx?$|\\.config\\.(m|c)?[jt]s$|(^|/)scripts/|^packages/api-contract/',
    },
    tsPreCompilationDeps: true,
    moduleSystems: ['cjs', 'es6'],
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
      mainFields: ['types', 'main'],
    },
  },
};
