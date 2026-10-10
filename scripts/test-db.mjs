// Roda cada arquivo de supabase/tests contra o projeto vinculado.
// Cada arquivo abre uma transação e termina com rollback, então nada fica salvo.
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const dir = 'supabase/tests'
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
let failed = 0

for (const file of files) {
  try {
    const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', `${dir}/${file}`], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (/"result":\s*"PASS"/.test(out)) {
      console.log(`✓ ${file}`)
    } else {
      failed++
      console.error(`✗ ${file}\n${out}`)
    }
  } catch (err) {
    failed++
    console.error(`✗ ${file}\n${err.stdout ?? ''}${err.stderr ?? ''}`)
  }
}

process.exit(failed ? 1 : 0)
