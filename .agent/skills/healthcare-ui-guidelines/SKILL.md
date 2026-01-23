---
name: healthcare-ui-guidelines
description: Define padrões de interface e experiência do usuário específicos para aplicações de saúde mental, priorizando acessibilidade, clareza, redução de carga cognitiva e conformidade com diretrizes de usabilidade em contextos clínicos
---

# Healthcare UI Guidelines

## Purpose

Garantir que a interface do sistema de gestão clínica seja profissional, acessível, intuitiva e apropriada para o contexto de saúde mental. Esta skill assegura que psicólogos possam trabalhar eficientemente sem distrações, que informações críticas sejam apresentadas com clareza, e que a experiência do usuário reduza erros operacionais em um ambiente onde precisão é fundamental.

## When to use this skill

- Ao criar ou modificar formulários de cadastro e edição de dados
- Ao desenvolver interfaces de agenda e visualização de compromissos
- Ao implementar dashboards, relatórios e visualizações de dados
- Ao projetar fluxos de navegação entre módulos do sistema
- Ao definir hierarquia visual e uso de cores
- Ao escolher componentes de UI (modais, dropdowns, date pickers)
- Ao implementar estados de loading, erro e feedback de ações
- Ao desenvolver versões mobile ou responsivas

## Responsibilities

1. **Garantir hierarquia de informação clara:**
   - Dados críticos (nome do paciente, horário da sessão) devem ter destaque visual
   - Informações secundárias devem ser acessíveis mas não competir por atenção
   - Uso consistente de tamanhos de fonte, pesos e espaçamentos

2. **Reduzir carga cognitiva:**
   - Minimizar número de cliques para ações frequentes
   - Evitar sobrecarga de informações na mesma tela
   - Implementar navegação previsível e consistente
   - Usar linguagem clara, sem jargões técnicos desnecessários

3. **Implementar acessibilidade (WCAG 2.1 AA):**
   - Contraste mínimo de 4.5:1 para textos normais
   - Todos os elementos interativos navegáveis por teclado
   - Labels descritivos em campos de formulário
   - Feedback visual e sonoro para ações críticas

4. **Prevenir erros operacionais:**
   - Confirmação para ações destrutivas (exclusão, cancelamento de agendamentos)
   - Validação em tempo real de campos obrigatórios
   - Mensagens de erro específicas e orientadas a ação
   - Desabilitar botões de ação durante processamento

5. **Manter contexto clínico:**
   - Evitar cores associadas a emoções negativas em contextos neutros
   - Usar linguagem empática e profissional
   - Respeitar terminologia da psicologia (ex: "sessão" ao invés de "reunião")

## Rules and Constraints

### ✅ PERMITIDO

- Usar paleta de cores neutras e profissionais (azuis, cinzas, brancos)
- Implementar modo escuro para redução de fadiga visual
- Exibir indicadores de status claros (sessão confirmada, pendente, cancelada)
- Usar ícones universalmente reconhecidos com labels de texto
- Implementar tooltips informativos para campos complexos
- Manter formulários em uma única coluna para leitura linear
- Usar componentes de UI de bibliotecas estabelecidas (shadcn/ui, Radix)

### ❌ PROIBIDO

- Usar cores vibrantes ou "agressivas" (vermelhos intensos, laranjas fortes) exceto para alertas críticos
- Implementar animações excessivas ou transições longas (>300ms)
- Criar formulários com mais de 7 campos visíveis simultaneamente sem agrupamento
- Usar placeholders como único indicador de função do campo
- Exibir múltiplos modais ou overlays simultaneamente
- Implementar infinite scroll em listas críticas (usar paginação)
- Ocultar ações importantes em menus de três pontos sem indicação clara
- Usar jargões técnicos de desenvolvimento na interface (ex: "Error 500", "null", "undefined")

## Validation Checklist

Antes de considerar qualquer interface como concluída, valide:

- [ ] A hierarquia visual está clara? Informação mais importante tem destaque?
- [ ] Há contraste suficiente entre texto e fundo (mínimo 4.5:1)?
- [ ] Todos os elementos interativos são navegáveis por teclado (Tab, Enter, Esc)?
- [ ] Labels de formulário são claros e descritivos?
- [ ] Há validação em tempo real com mensagens de erro específicas?
- [ ] Ações destrutivas exigem confirmação explícita?
- [ ] Estados de loading são visualmente indicados durante operações assíncronas?
- [ ] Erros são apresentados de forma amigável com orientação de como resolver?
- [ ] A interface é responsiva e funcional em tablets (mínimo 768px)?
- [ ] Não há uso excessivo de cores saturadas ou animações distrativas?
- [ ] A linguagem utilizada é profissional e apropriada ao contexto clínico?
- [ ] Há feedback visual imediato para todas as ações do usuário?