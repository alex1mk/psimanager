---
name: Skill-Design-System-UX
description: Corpo visual do PsiManager. Define stack obrigatória (Tailwind + Shadcn/Radix), componentes padrão com código executável, regras de acessibilidade WCAG AA e padrões de feedback visual para o ambiente clínico de psicologia.
---

# Skill-Design-System-UX

## Purpose

Garantir que toda interface do PsiManager seja visualmente consistente, acessível e contextualmente apropriada para um ambiente clínico. Esta skill entrega componentes prontos para uso, não apenas diretrizes abstratas.

## When to use this skill

- Ao criar qualquer componente de UI
- Ao implementar feedback visual (loading, erro, sucesso)
- Ao construir formulários
- Ao projetar layouts de página
- Ao escolher cores, tipografia ou espaçamento

---

## 1. Stack Obrigatória

```
Tailwind CSS      → Estilo utilitário (configurado no vite.config)
Radix UI          → Primitivos acessíveis (Dialog, Dropdown, Tooltip)
Shadcn/UI         → Componentes pré-construídos sobre Radix
Lucide React      → Ícones consistentes
```

**Regra:** Nunca criar componente de scratch quando o Shadcn/Radix já oferece. Customizar via variantes, não reescrever.

---

## 2. Tokens de Design

```typescript
// src/lib/design-tokens.ts

export const colors = {
  // Primário — confiança, calma (contexto clínico)
  primary: {
    50:  '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',  // ← Ação principal
    700: '#1D4ED8',
    900: '#1E3A8A'
  },
  // Neutros
  gray: {
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    400: '#9CA3AF',
    600: '#4B5563',
    700: '#374151',
    900: '#111827'   // ← Texto principal
  },
  // Semânticos
  success: '#059669',
  warning: '#D97706',
  error:   '#DC2626',
  info:    '#0284C7'
};

export const typography = {
  base:    'text-base',      // 16px — mínimo permitido
  small:   'text-sm',        // 14px — apenas metadados
  heading: 'text-xl font-semibold text-gray-900',
  title:   'text-2xl font-bold text-gray-900',
  caption: 'text-xs text-gray-500' // 12px — timestamps apenas
};

export const spacing = {
  xs: 'p-1',   // 4px
  sm: 'p-2',   // 8px
  md: 'p-4',   // 16px
  lg: 'p-6',   // 24px
  xl: 'p-8'    // 32px
};
```

---

## 3. Componentes Padrão — Código Executável

### 3.1 Button com estado Loading

```tsx
// src/components/ui/Button.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  startIcon?: React.ReactNode;
}

const variants = {
  primary:      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary:    'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400',
  outline:      'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
  destructive:  'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost:        'text-gray-700 hover:bg-gray-100 focus:ring-gray-400'
};

const sizes = {
  sm: 'h-9  px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, startIcon, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Variante + Tamanho
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processando...</span>
          </>
        ) : (
          <>
            {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ─── USO ────────────────────────────────────────────
// <Button variant="primary" onClick={handleSave}>Salvar</Button>
// <Button variant="primary" loading={true}>Salvar</Button>
// <Button variant="destructive" startIcon={<Trash2 />}>Excluir</Button>
// <Button variant="outline" size="sm">Cancelar</Button>
```

### 3.2 Toast — Feedback de Sucesso / Erro

```tsx
// src/components/ui/Toast.tsx
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms — padrão 4000
  onClose: () => void;
}

const config = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon_color: 'text-green-600'
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon_color: 'text-red-600'
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon_color: 'text-amber-600'
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon_color: 'text-blue-600'
  }
};

export const Toast: React.FC<ToastProps> = ({ type, title, message, duration = 4000, onClose }) => {
  const [visible, setVisible] = useState(true);
  const { icon: Icon, bg, border, text, icon_color } = config[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Aguardar animação de saída
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-sm w-full',
        'transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        bg, border
      )}
      role="alert"
      aria-live="assertive"
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', icon_color)} />

      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm', text)}>{title}</p>
        {message && <p className={cn('text-sm mt-0.5', text, 'opacity-80')}>{message}</p>}
      </div>

      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded p-0.5"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// ─── CONTEXTO GLOBAL DE TOAST ────────────────────────
// src/components/ui/ToastProvider.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastItem extends ToastProps {
  id: string;
}

interface ToastContextType {
  toast: (props: Omit<ToastProps, 'onClose'>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((props: Omit<ToastProps, 'onClose'>) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { ...props, id, onClose: () => removeToast(id) }]);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Container de Toasts — canto superior direito */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map(t => (
          <Toast key={t.id} {...t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return context;
};

// ─── USO FINAL ───────────────────────────────────────
// const { toast } = useToast();
//
// toast({ type: 'success', title: 'Paciente criado', message: 'O cadastro foi concluído com sucesso.' });
// toast({ type: 'error',   title: 'Erro',            message: 'Não foi possível salvar. Tente novamente.' });
// toast({ type: 'warning', title: 'Atenção',         message: 'Sessão com menos de 24h de antecedência.' });
```

### 3.3 Input com Label, Erro e Helper

```tsx
// src/components/ui/Input.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, required, className, id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>

        <input
          ref={ref}
          id={inputId}
          required={required}
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-base',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'placeholder-gray-400',
            error
              ? 'border-red-300 bg-red-50 text-red-900'
              : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />

        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-gray-500">{helperText}</p>
        )}

        {error && (
          <p id={`${inputId}-error`} className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ─── USO ────────────────────────────────────────────
// <Input label="Nome completo" required placeholder="Ex: João da Silva" />
// <Input label="Email" type="email" error="Email inválido" />
// <Input label="CPF" helperText="Utilizado apenas para emissão de recibos" />
```

---

## 4. Regras de Acessibilidade (WCAG AA)

### Contraste mínimo
| Elemento | Mínimo | Realizado |
|----------|--------|-----------|
| Texto normal (body) | 4.5:1 | gray-900 (#111827) sobre branco = 16.7:1 ✓ |
| Texto secundário | 4.5:1 | gray-600 (#4B5563) sobre branco = 8.4:1 ✓ |
| Texto desabilitado | 3:1 | gray-400 (#9CA3AF) = 3.4:1 ✓ |
| Texto sobre azul-600 | 4.5:1 | Branco sobre #2563EB = 5.1:1 ✓ |

### Navegação por teclado
```
Tab          → Foco no próximo elemento interativo
Shift+Tab    → Foco no elemento anterior
Enter/Space  → Ativar botão ou link focado
Escape       → Fechar modal, dropdown ou tooltip
```

**Regra de implementação:**
```tsx
// Todo elemento interativo customizado DEVE ter:
// 1. tabIndex={0} se não for nativo (button/a/input)
// 2. onKeyDown para Enter/Space
// 3. Estilo de foco visível: focus:ring-2 focus:ring-blue-500 focus:ring-offset-2

<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
  className="... focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
>
  Conteúdo
</div>
```

### Labels obrigatórios
```
❌ PROIBIDO: usar placeholder como única indicação do campo
❌ PROIBIDO: botão com apenas ícone sem aria-label
❌ PROIBIDO: cor como única forma de comunicar estado

✅ CORRETO: label sempre visível acima do campo
✅ CORRETO: <button aria-label="Fechar modal"><X /></button>
✅ CORRETO: estado indicado por cor + texto + ícone
```

---

## 5. Layout e Estrutura de Página

### Esqueleto padrão
```tsx
// src/components/ui/PageLayout.tsx
import React from 'react';

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode; // Botões no cabeçalho
}

export const PageLayout: React.FC<PageLayoutProps> = ({ title, actions, children }) => (
  <div className="min-h-screen bg-gray-50">
    {/* Header da página */}
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </header>

    {/* Corpo */}
    <main className="max-w-7xl mx-auto px-6 py-8">
      {children}
    </main>
  </div>
);
```

---

## Validation Checklist

- [ ] Todos os componentes usam Tailwind? Nenhum `style={{}}` inline?
- [ ] Componentes interativos customizados têm navegação por teclado?
- [ ] Labels são sempre visíveis (não apenas placeholders)?
- [ ] Estados de erro exibem texto + ícone (não apenas cor)?
- [ ] Loading state desabilita o botão para evitar duplo clique?
- [ ] Toast é acessível com `role="alert"` e `aria-live`?
- [ ] Tamanho mínimo de fonte é 14px (text-sm)? Corpo usa 16px (text-base)?
- [ ] Contraste mínimo 4.5:1 em todos os textos?
- [ ] Modais bloqueiam foco internamente e fecham com Escape?