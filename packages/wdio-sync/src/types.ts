import { Options } from '@wdio/types'

export interface PluginOpts {
    wdioConfig: Options.Testrunner
}

export interface TransformOpts {
    readonly opts: PluginOpts
}
