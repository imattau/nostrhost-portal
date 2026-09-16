import { readFile } from 'node:fs/promises'

const errorPage = await readFile(
  new URL('../error.vue', import.meta.url),
  'utf8',
)

if (!errorPage.includes('NostrHost')) {
  throw new Error('Portal error page must identify the product as NostrHost')
}

if (/yunohost/i.test(errorPage)) {
  throw new Error('Portal error page must not regress to YunoHost branding')
}

console.log('Portal error branding: NostrHost')
