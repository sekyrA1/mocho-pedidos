import { mkdirSync, readdirSync, copyFileSync, cpSync, writeFileSync } from 'node:fs';
// Explicit browser-only artifact: no env, SQL, backend sources or admin tooling.
mkdirSync('dist',{recursive:true});
for(const file of readdirSync('.')) if(/\.(html|css|js)$/.test(file)) copyFileSync(file,`dist/${file}`);
cpSync('assets','dist/assets',{recursive:true});
writeFileSync('dist/.nojekyll','');
console.log('Site empacotado em dist/ (somente arquivos públicos).');
