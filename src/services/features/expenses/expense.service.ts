import { BaseService } from "../../core/base.service";
import { Expense, ExpenseType } from "../../../types";

export class ExpenseService extends BaseService {
    constructor() {
        super('expenses');
    }

    async getAll(): Promise<Expense[]> {
        const user = await this.ensureAuthenticated();

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (error) this.handleError(error);

        return data.map(e => ({
            id: e.id,
            description: e.description,
            amount: Number(e.amount),
            date: e.date,
            category: e.category,
            type: e.expense_type as ExpenseType,
            receiptUrl: e.receipt_url,
            merchantName: e.merchant_name
        }));
    }

    async create(expense: Expense): Promise<Expense> {
        const user = await this.ensureAuthenticated();

        const { data, error } = await this.supabase
            .from(this.tableName)
            .insert({
                description: expense.description,
                merchant_name: expense.merchantName,
                amount: expense.amount,
                date: expense.date,
                category: expense.category,
                expense_type: expense.type === ExpenseType.PF ? 'PF' : 'PJ',
                receipt_url: expense.receiptUrl,
                user_id: user.id
            })
            .select()
            .single();

        if (error) this.handleError(error);

        return {
            id: data.id,
            description: data.description,
            amount: Number(data.amount),
            date: data.date,
            category: data.category,
            type: data.expense_type as ExpenseType,
            receiptUrl: data.receipt_url,
            merchantName: data.merchant_name
        };
    }

    async update(expense: Expense): Promise<Expense> {
        const user = await this.ensureAuthenticated();

        const { data, error } = await this.supabase
            .from(this.tableName)
            .update({
                description: expense.description,
                merchant_name: expense.merchantName,
                amount: expense.amount,
                date: expense.date,
                category: expense.category,
                expense_type: expense.type === ExpenseType.PF ? 'PF' : 'PJ',
                receipt_url: expense.receiptUrl,
                user_id: user.id
            })
            .eq('id', expense.id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) this.handleError(error);

        return {
            id: data.id,
            description: data.description,
            amount: Number(data.amount),
            date: data.date,
            category: data.category,
            type: data.expense_type as ExpenseType,
            receiptUrl: data.receipt_url,
            merchantName: data.merchant_name
        };
    }

    async delete(id: string): Promise<void> {
        const user = await this.ensureAuthenticated();

        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) this.handleError(error);
    }
}

export const expenseService = new ExpenseService();
