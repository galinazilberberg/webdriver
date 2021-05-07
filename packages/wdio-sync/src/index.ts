import logger from '@wdio/logger'
import { PluginObj } from '@babel/core'
import * as t from '@babel/types'

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
            ExpressionStatement (path) {
                /**
                 * transform any
                 *  browser.XXX(...)
                 * into
                 *  await browser.XXX(...)
                 */
                if (
                    t.isCallExpression(path.node.expression) &&
                    t.isMemberExpression(path.node.expression.callee) &&
                    t.isIdentifier(path.node.expression.callee.object) &&
                    path.node.expression.callee.object.name === 'browser'
                ) {
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
