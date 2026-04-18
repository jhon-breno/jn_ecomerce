# Melhoria Futura: Envio de E-mails Automáticos

## Objetivo

Implementar no site um fluxo profissional de envio de e-mails automáticos para o cliente e também permitir disparos manuais pelo painel administrativo.

Casos principais:

- enviar confirmação automática quando o pedido for criado
- enviar atualização automática quando o status do pedido mudar
- permitir reenvio manual de e-mail pelo admin
- permitir envio manual de mensagem por botão direto no site/admin

## Melhor abordagem recomendada

Não usar envio de e-mail direto pelo front-end.

O melhor desenho é:

- Front-end React continua cuidando da interface
- Firestore continua guardando pedidos, clientes e histórico
- um backend seguro faz o disparo dos e-mails
- um serviço externo de e-mail transacional realiza a entrega

Serviços recomendados:

- Resend
- Brevo
- SendGrid
- Mailgun

Entre eles, a melhor recomendação inicial para este projeto é o Resend pela simplicidade de integração e manutenção.

## O que o Firebase gratuito faz e o que não faz

O Firebase pode ajudar com:

- hospedagem do site
- banco de dados
- autenticação
- funções serverless, se quisermos usar Cloud Functions

O Firebase não fornece:

- caixa de e-mail própria
- SMTP nativo para envio profissional
- webmail do tipo contato@seudominio.com

## Arquitetura sugerida para este projeto

### Opção 1: usar o backend Node já existente

Usar o backend em loja-backend para:

- receber eventos de pedido criado
- receber eventos de alteração de status
- montar o HTML do e-mail
- chamar a API do provedor de e-mail
- registrar logs de envio

Vantagens:

- aproveita a estrutura já existente
- mantém segredos no servidor
- facilita criação de endpoints manuais para admin

### Opção 2: usar Firebase Cloud Functions

Usar funções para:

- reagir a criação/atualização de pedidos
- enviar e-mails automaticamente
- registrar falhas e sucessos

Vantagens:

- integração próxima do Firebase
- menos dependência de servidor separado

### Recomendação final

Para este projeto, o caminho mais prático tende a ser usar o backend Node já existente ou, se quisermos centralizar tudo no Firebase, usar Cloud Functions.

## Fluxos que devem existir

### 1. Confirmação de pedido

Quando o cliente finalizar o pedido:

1. o pedido é salvo no Firestore
2. o backend recebe os dados do pedido
3. o backend monta o e-mail
4. o e-mail é enviado ao cliente
5. o sistema registra sucesso ou falha

Conteúdo do e-mail:

- número do pedido
- nome do cliente
- itens comprados
- variações escolhidas
- personalização, se houver
- endereço de entrega
- valor total
- forma de pagamento
- status inicial do pedido

### 2. Atualização de status

Quando o admin mudar o status do pedido:

1. o sistema detecta a mudança
2. o backend monta um e-mail com o novo status
3. o e-mail é enviado ao cliente
4. o envio é registrado no histórico

Exemplos de status úteis para disparo:

- pedido recebido
- pagamento aprovado
- em separação
- enviado
- entregue
- cancelado

### 3. Envio manual pelo admin

No painel administrativo, o pedido deve ter ações como:

- reenviar confirmação
- enviar atualização manual
- enviar e-mail livre

Campos esperados nesse fluxo:

- assunto
- mensagem
- destinatário
- tipo/modelo do e-mail

## O que seria necessário configurar

### Serviço de e-mail

- criar conta no provedor escolhido
- validar domínio de envio
- obter chave de API

### Domínio

Configurar DNS com os registros exigidos pelo provedor:

- SPF
- DKIM
- opcionalmente DMARC

### Remetente

Exemplos:

- no-reply@jnfutshirt.com.br
- pedidos@jnfutshirt.com.br
- atendimento@jnfutshirt.com.br

### Backend

Criar endpoints ou funções para:

- enviar confirmação de pedido
- enviar atualização de status
- reenviar e-mail manualmente
- registrar logs de entrega

## Funcionalidades recomendadas no admin

- botão Reenviar confirmação
- botão Enviar atualização
- botão Enviar e-mail manual
- visualização do último envio
- histórico de envios do pedido
- status do envio: enviado, pendente ou falhou

## Boas práticas obrigatórias

- nunca enviar e-mail direto do React com chave de API exposta
- nunca salvar senha SMTP no front-end
- manter credenciais apenas no backend
- registrar logs de envio e erro
- evitar envios duplicados
- padronizar templates responsivos
- validar domínio corretamente para reduzir risco de spam

## Etapas sugeridas de implementação

### Etapa 1: Base

- escolher o provedor de e-mail
- validar domínio
- configurar backend de envio
- testar envio simples

### Etapa 2: Automação

- confirmação de pedido
- atualização automática de status
- registro de logs

### Etapa 3: Operação no admin

- botão de reenvio
- botão de envio manual
- modelos de e-mail
- histórico visual de disparos

## Recomendação objetiva

Se a melhoria for implementada no futuro, a recomendação principal é:

- usar Resend como provedor de e-mail transacional
- fazer o envio pelo backend seguro
- disparar e-mails automáticos em pedido criado e status alterado
- adicionar no admin botões para reenvio e envio manual

Esse desenho entrega uma solução mais profissional, segura e escalável para a loja.
