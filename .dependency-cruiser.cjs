// Module boundaries and engine purity (ENGINEERING_RULES §2.2, §16). `pnpm deps:check` runs it.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'engine-pure',
      comment:
        '@figcit/engine and @figcit/engine-v2 are pure: no Node built-ins and nothing outside their own package.',
      severity: 'error',
      from: { path: '^packages/(engine|engine-v2)/src' },
      to: { pathNot: '^packages/$1/src' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-dev-deps-in-src',
      comment: 'Shipped code may not import devDependencies.',
      severity: 'error',
      from: { path: '^(apps/api|packages/[^/]+)/src', pathNot: '\\.spec\\.ts$' },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage|node_modules)/' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['development', 'import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
      extensions: ['.ts', '.js', '.mjs', '.json'],
    },
  },
};
