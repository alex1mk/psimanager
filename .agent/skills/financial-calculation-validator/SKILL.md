---
name: financial-calculation-validator
description: Garante precisão e conformidade em todos os cálculos financeiros, incluindo valores de sessões, impostos, recibos, relatórios e integração com obrigações fiscais, prevenindo erros que podem resultar em problemas legais ou perda financeira
---

# Financial Calculation Validator

## Purpose

Assegurar que todos os cálculos financeiros no sistema sejam matematicamente corretos, consistentes, auditáveis e em conformidade com regulamentações fiscais brasileiras aplicáveis a profissionais autônomos da área de saúde. Esta skill previne discrepâncias financeiras, erros em emissão de recibos e problemas com declarações fiscais que podem gerar multas ou autuações.

## When to use this skill

- Ao implementar cálculo de valores de sessões (individuais, pacotes, descontos)
- Ao desenvolver emissão de recibos com retenções fiscais
- Ao criar relatórios financeiros (faturamento mensal, anual, por paciente)
- Ao implementar funcionalidades de impostos (IRPF, ISS, INSS)
- Ao desenvolver reconciliação de pagamentos e controle de inadimplência
- Ao criar exportações para contabilidade ou declaração de imposto de renda
- Ao implementar conversão de moedas ou cálculos de reajuste
- Ao desenvolver dashboards com métricas financeiras

## Responsibilities

1. **Garantir precisão de arredondamento:**
   - Usar sempre tipos de dados `NUMERIC` ou `DECIMAL` no banco de dados
   - Evitar `FLOAT` ou `DOUBLE` para valores monetários
   - Arredondar apenas na apresentação final, nunca em cálculos intermediários
   - Usar arredondamento bancário (half-to-even) para valores exatos de 0.5

2. **Implementar cálculos fiscais corretos:**
   - ISS: alíquota varia por município (geralmente 2% a 5%)
   - IRPF: retenção na fonte conforme tabela progressiva do ano vigente
   - INSS: contribuição autônoma com limites mínimo e máximo
   - Validar se retenções aplicam-se ao caso específico (MEI, prestador pessoa física, etc.)

3. **Manter consistência de dados:**
   - Valor da sessão em `expenses` deve bater com valor em `appointments`
   - Soma de sessões individuais deve igualar valor do pacote (se aplicável)
   - Total de recibos emitidos deve corresponder ao faturamento registrado
   - Implementar transações atômicas para operações financeiras críticas

4. **Garantir auditabilidade:**
   - Registrar histórico de alterações de valores (audit log)
   - Armazenar cálculos intermediários quando relevante
   - Incluir metadados em recibos (data de emissão, método de cálculo, versão do sistema)
   - Permitir rastreabilidade de cada valor até sua origem

5. **Validar regras de negócio:**
   - Impedir valores negativos em campos de receita
   - Validar descontos dentro de limites razoáveis (ex: máximo 50%)
   - Alertar sobre valores atípicos (ex: sessão com valor 10x acima da média)
   - Verificar completude de dados antes de emissão de documentos fiscais

## Rules and Constraints

### ✅ PERMITIDO

- Armazenar valores em centavos (inteiros) para evitar problemas de ponto flutuante
- Usar bibliotecas especializadas para cálculos monetários (ex: `currency.js`, `dinero.js`)
- Implementar logs detalhados de todas as operações financeiras
- Criar campos separados para "valor bruto" e "valor líquido" (após deduções)
- Permitir múltiplas formas de pagamento para uma mesma sessão
- Implementar campos de "observações" para justificar ajustes manuais

### ❌ PROIBIDO

- Usar tipos de dados flutuantes (`FLOAT`, `DOUBLE`, `REAL`) para valores monetários
- Realizar arredondamentos em cascata (arredondar resultados de operações já arredondadas)
- Calcular impostos sem considerar faixas progressivas e limites de isenção
- Permitir alteração retroativa de valores sem registro de auditoria
- Emitir recibos sem validar completude de dados obrigatórios (CPF, endereço, valor)
- Implementar descontos percentuais acumulativos sem limite máximo
- Armazenar valores calculados sem armazenar também os parâmetros usados no cálculo
- Expor lógica de cálculo fiscal no frontend (deve ser server-side ou database functions)

## Validation Checklist

Antes de considerar qualquer funcionalidade financeira como concluída, valide:

- [ ] Valores monetários estão armazenados como `NUMERIC(10,2)` ou tipo equivalente?
- [ ] Cálculos intermediários não realizam arredondamentos desnecessários?
- [ ] Há validação de valores mínimos e máximos razoáveis para cada campo?
- [ ] Impostos são calculados conforme legislação vigente e município específico?
- [ ] Há verificação de integridade entre tabelas relacionadas (appointments ↔ expenses ↔ receipts)?
- [ ] Operações financeiras críticas estão envolvidas em transações atômicas?
- [ ] Logs de auditoria registram quem, quando e qual valor foi alterado?
- [ ] Recibos incluem todos os campos obrigatórios conforme legislação?
- [ ] Relatórios financeiros podem ser recalculados a partir dos dados brutos?
- [ ] Há tratamento de casos especiais (cancelamentos, reembolsos, ajustes)?
- [ ] Testes unitários cobrem cenários de edge cases (valores extremos, divisões por zero)?
- [ ] Validação de CPF/CNPJ implementada antes de emissão de documentos fiscais?