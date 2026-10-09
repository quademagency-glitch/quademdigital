// The live PowerPoint-to-PDF step (src/lib/deckConvert.ts), run for real by
// check.sh. Node 24 reads the TypeScript as it is.
import { convertToPdf } from '../../src/lib/deckConvert.ts'

const [input, outDir] = process.argv.slice(2)
console.log(await convertToPdf(input, outDir))
