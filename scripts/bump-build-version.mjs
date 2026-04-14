import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const metaPath = path.join(projectRoot, 'build-meta.json')

async function run() {
  let build = 0

  try {
    const raw = await readFile(metaPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Number.isInteger(parsed?.build) && parsed.build >= 0) {
      build = parsed.build
    }
  } catch {
    build = 0
  }

  const next = {
    build: build + 1
  }

  await mkdir(path.dirname(metaPath), { recursive: true })
  await writeFile(metaPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  process.stdout.write(`Build number bumped to ${next.build}\n`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
