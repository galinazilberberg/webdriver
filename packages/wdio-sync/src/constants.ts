import * as protocols from '@wdio/protocols'
import browserCommands from 'webdriverio/build/commands/browser'
import elementCommands from 'webdriverio/build/commands/browser'

export const COMMAND_NAMES = [
    // protocol commands
    ...Object.values(protocols).map(
        (p) => p && Object.values(p).map(
            (pp) => pp && Object.values(pp).map(
                (ppp) => ppp.command
            )
            // @ts-expect-error
        ).flat()
    // @ts-expect-error
    ).flat(),
    ...Object.keys(browserCommands),
    ...Object.keys(elementCommands)
]
