import { assertCodeFromFixture } from './test.utils'

describe('@wdio/sync', () => {
    it('should transform browser commands', async () => {
        await assertCodeFromFixture('browser-commands')
    })
})
