import logger from '@wdio/logger'
import type { Options } from '@wdio/types'
import type { Browser, Element, MultiRemoteBrowser } from 'webdriverio'

import executeHooksWithArgs from './executeHooksWithArgs'
import { sanitizeErrorMessage } from './utils'
import { Future } from './fibers'

const log = logger('@wdio/sync')

let inCommandHook = false
const timers: any[] = []
const elements: Set<Element<'async'>> = new Set()

declare global {
    var WDIO_WORKER: boolean
}

/**
 * resets `_NOT_FIBER` if Timer has timed out
 */
process.on('WDIO_TIMER', (payload) => {
    if (payload.start) {
        return timers.push(payload.id)
    }
    if (timers.includes(payload.id)) {
        while (timers.pop() !== payload.id);
    }
    if (payload.timeout) {
        elements.forEach(/* istanbul ignore next */ element => { delete element._NOT_FIBER })
    }
    if (timers.length === 0) {
        elements.clear()
    }
})

/**
 * wraps a function into a Fiber ready context to enable sync execution and hooks
 * @param  {Function}   fn             function to be executed
 * @param  {String}     commandName    name of that function
 * @param  {Function[]} beforeCommand  method to be executed before calling the actual function
 * @param  {Function[]} afterCommand   method to be executed after calling the actual function
 * @return {Function}   actual wrapped function
 */
export default function wrapCommand (commandName: string, fn: Function) {
    return function wrapCommandFn(this: Browser<'async'> | Element<'async'>, ...args: any[]) {
        /**
         * print error if a user is using a fiberized command outside of the Fibers context
         */
        if (!global._HAS_FIBER_CONTEXT && global.WDIO_WORKER) {
            log.warn(
                `Can't return command result of ${commandName} synchronously because command ` +
                'was executed outside of an it block, hook or step definition!'
            )
        }

        /**
         * store element if Timer is running to reset `_NOT_FIBER` if timeout has occurred
         */
        if (timers.length > 0) {
            elements.add(this as Element<'async'>)
        }

        /**
         * Avoid running some functions in Future that are not in Fiber.
         */
        if (this._NOT_FIBER === true) {
            this._NOT_FIBER = isNotInFiber(this as Element<'async'>, fn.name)
            return fn.apply(this, args)
        }
        /**
         * all named nested functions run in parent Fiber context
         */
        this._NOT_FIBER = fn.name !== ''

        const future = new Future()

        const result = runCommandWithHooks.apply(this, [commandName, fn, ...args])
        result.then(future.return.bind(future), future.throw.bind(future))

        try {
            const futureResult = future.wait()
            inFiber(this)
            return futureResult
        } catch (err: any) {
            /**
             * in case some 3rd party lib rejects without bundling into an error
             */
            if (typeof err === 'string') {
                throw new Error(err)
            }

            /**
             * in case we run commands where no fiber function was used
             * e.g. when we call deleteSession
             */
            if (err.message.includes('Can\'t wait without a fiber')) {
                return result
            }

            inFiber(this)
            throw err
        }
    }
}

/**
 * helper method that runs the command with before/afterCommand hook
 */
async function runCommandWithHooks(
    this: Browser<'async'> | Element<'async'>,
    commandName: string,
    fn: Function,
    ...args: any[]
) {
    // save error for getting full stack in case of failure
    // should be before any async calls
    const stackError = new Error()

    await runCommandHook.call(this, 'beforeCommand', (this.options as Options.Testrunner).beforeCommand, [commandName, args])

    let commandResult
    let commandError
    try {
        commandResult = await fn.apply(this, args)
    } catch (err: any) {
        commandError = sanitizeErrorMessage(err, stackError)
    }

    await runCommandHook.call(this, 'afterCommand', (this.options as Options.Testrunner).afterCommand, [commandName, args, commandResult, commandError])

    if (commandError) {
        throw commandError
    }

    return commandResult
}

async function runCommandHook(hookName: string, hookFn?: Function | Function[], args?: any[]) {
    if (!inCommandHook) {
        inCommandHook = true
        await executeHooksWithArgs(hookName, hookFn, args)
        inCommandHook = false
    }
}

/**
 * isNotInFiber
 * if element or its parent has element id then we are in parent's Fiber
 * @param {object} context browser or element
 * @param {string} fnName function name
 */
function isNotInFiber(context: Element<'async'>, fnName: string) {
    return fnName !== '' && !!(context.elementId || (context.parent && (context.parent as Element<'async'>).elementId))
}

/**
 * set `_NOT_FIBER` to `false` for element and its parents
 * @param {object} context browser or element
 */
function inFiber (context: Browser<'async'> | Element<'async'> | MultiRemoteBrowser<'async'>) {
    const multiRemoteContext = context as MultiRemoteBrowser<'async'>
    if (multiRemoteContext.constructor.name === 'MultiRemoteDriver') {
        return multiRemoteContext.instances.forEach(instance => {
            multiRemoteContext[instance]._NOT_FIBER = false
            let parent = (multiRemoteContext[instance] as Element<'async'>).parent
            while (parent && parent._NOT_FIBER) {
                parent._NOT_FIBER = false
                parent = (parent as Element<'async'>).parent
            }
        })
    }

    context._NOT_FIBER = false
    let parent = (context as Element<'async'>).parent
    while (parent && parent._NOT_FIBER) {
        parent._NOT_FIBER = false
        parent = (parent as Element<'async'>).parent
    }
}
