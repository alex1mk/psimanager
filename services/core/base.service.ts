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
        console.error(`[${this.tableName} Service Error]:`, error)
        if (error.message) throw new Error(error.message)
        throw error
    }
}
