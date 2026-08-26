// vue-awesome ships its icon modules as untranspiled ESM, which Jest cannot
// require. Every `import 'vue-awesome/icons/<name>'` is a side-effect import
// that only registers icon data for the globally stubbed <icon> component, so
// tests lose nothing by mapping them all to this empty module. Without it,
// any test that pulls in a view importing icons transitively dies with
// "Cannot use import statement outside a module".
module.exports = {};
