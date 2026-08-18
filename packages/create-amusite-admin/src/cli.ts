import { runCli } from './index'

void runCli().then((code) => {
  process.exitCode = code
})
