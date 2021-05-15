import logger from '@wdio/logger'
import { PluginObj } from '@babel/core'

import CallExpression from './transforms/callExpressions'
import MemberExpression from './transforms/memberExpressions'
import ExpressionStatement from './transforms/expressionStatements'

import type { TransformOpts } from './types'

const log = logger('@wdio/sync')

log.info('plugin loaded')
export default function(): PluginObj<TransformOpts> {
    return {
        name: '@wdio/sync',
        visitor: {
            MemberExpression,
            ExpressionStatement,
            CallExpression
        }
    }
}
