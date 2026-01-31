import { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../src/lib/supabase'

export abstract class BaseService {
    protected supabase: SupabaseClient
    protected tableName: string

    constructor(tableName: string) {
        this.supabase = supabase
        this.tableName = tableName
    }

    /**
     * Ensures the user is authenticated before performing actions.
     * Throws an error if no session is active.
     */
    protected async ensureAuthenticated() {
        const { data: { user }, error } = await this.supabase.auth.getUser()
        if (error || !user) throw new Error('Autenticação necessária. Faça login novamente.')
        return user
    }

    /**
     * Standardized error handler
     */
    protected handleError(error: any): never {
        const { parseSupabaseError, showErrorToast } = require('../../src/lib/error-handler')
        const parsedError = parseSupabaseError(error)
        console.error(`[${this.tableName} Service Error]:`, parsedError)
        showErrorToast(error)
        throw new Error(parsedError.message)
    }
}
