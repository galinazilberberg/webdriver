import logger from '@wdio/logger'
import { PluginObj } from '@babel/core'
import * as t from '@babel/types'

import type { Options } from '@wdio/types'

import { COMMAND_NAMES } from './constants'

const log = logger('@wdio/sync')

interface TransformOpts {
    readonly opts: any
}

let options: Options.Testrunner = {
    capabilities: []
}

log.info('plugin loaded')
export default function(): PluginObj<TransformOpts> {
    return {
        name: '@wdio/sync',
        manipulateOptions(_options: any) {
            const plugin = _options.plugins.find((p: any) => p.key === '@wdio/sync')
            options = plugin.options
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
            },
            ExpressionStatement (path) {
                /**
                 * transform
                 *  expect(...)
                 * into
                 *  await expect(...)
                 */
                if (
                    t.isCallExpression(path.node.expression) &&
                    t.isMemberExpression(path.node.expression.callee) &&
                    t.isCallExpression(path.node.expression.callee.object) &&
                    t.isIdentifier(path.node.expression.callee.object.callee) &&
                    path.node.expression.callee.object.callee.name === 'expect'
                ) {
                    if (options.framework !== 'jasmine') {
                        path.node.expression.callee.object.callee.name = 'expectAsync'
                    }

                    path.replaceWith(
                        t.expressionStatement(
                            t.awaitExpression(path.node.expression)
                        )
                    )
                }
            }
        }
    }
}
