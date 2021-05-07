import logger from '@wdio/logger'
import { PluginObj } from '@babel/core'
import * as t from '@babel/types'

import { COMMAND_NAMES } from './constants'

const log = logger('@wdio/sync')

interface TransformOpts {
    readonly opts: any
}

log.info('plugin loaded')
export default function(): PluginObj<TransformOpts> {
    return {
        name: '@wdio/sync',
        manipulateOptions(_options: any, parserOptions: { plugins: string[] }) {
            console.log('_options', _options)
            console.log('parserOptions', parserOptions)
        },
        visitor: {
            MemberExpression (path) {
                /**
                 * transform any
                 *  browser.XXX(...)
                 * into
                 *  await browser.XXX(...)
                 */
                if (
                    t.isIdentifier(path.node.object) &&
                    path.node.object.name === 'browser' &&
                    t.isIdentifier(path.node.property) &&
                    COMMAND_NAMES.includes(path.node.property.name) &&
                    t.isCallExpression(path.parentPath.node) &&
                    !t.isAwaitExpression(path.parentPath.parentPath.node)
                ) {
                    path.parentPath.replaceWith(
                        t.awaitExpression(path.parentPath.node)
                    )

                    const fn = path.getFunctionParent()
                    if (!fn?.node.async) {
                        // @ts-expect-error
                        fn?.node.async = true
                    }
                }
            }
        }
    }
}
