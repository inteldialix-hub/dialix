import fs from 'node:fs';

const categories = ['integrations', 'solutions', 'comparisons', 'templates'];
for (const cat of categories) {
  const content = fs.readFileSync(`ai/src/data/seo/${cat}.ts`, 'utf-8');
  const matches = [...content.matchAll(/"slug":\s*"([^"]+)"/g)].map(m => m[1]);
  console.log(cat, 'count:', matches.length, 'sample:', matches.slice(0, 8));
}
