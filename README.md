# 💈 Ded Black Barbershop - Sistema de Agendamentos & Clube de Assinatura

Aplicação web completa e responsiva desenvolvida para a **Ded Black Barbershop**, oferecendo agendamento online de serviços de barbearia, gestão do clube de assinatura, autenticação segura com Google/E-mail via Firebase e painel administrativo em tempo real.

---

## 🚀 Funcionalidades Principais

- **Agendamento Online Instantâneo:** Seleção de serviços, horários e atendimento com o barbeiro preferencial (**André Black**).
- **Clube de Assinatura:** Inscrição e gerenciamento de membros com descontos e benefícios exclusivos.
- **Autenticação Firebase:** Login simples e seguro por Google OAuth ou E-mail e Senha.
- **Integração Realtime Firestore:** Sincronização em tempo real de agendamentos e assinantes ativas.
- **Painel do Barbeiro & Administração:** Visualização de agenda do dia, alteração de status e métricas.
- **Regras de Segurança Firestore:** Proteção de dados PII e privilégios administrativos aplicados.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Motion (`framer-motion`)
- **Backend & Database:** Firebase Authentication, Cloud Firestore
- **Build & Qualidade:** TypeScript Compiler, ESLint

---

## 💻 Como Rodar o Projeto Localmente

### Pré-requisitos
- Node.js (versão 18 ou superior)
- npm ou yarn

### Passo a Passo

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Iniciar o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   O aplicativo estará disponível em `http://localhost:3000`.

3. **Verificar erros de compilação (Linter):**
   ```bash
   npm run lint
   ```

4. **Gerar build de produção:**
   ```bash
   npm run build
   ```

---

## 🔒 Parâmetros de Segurança do Firebase

As regras de segurança do Cloud Firestore (`firestore.rules`) garantem:
- Leitura em tempo real dos horários públicos disponíveis para agendamento.
- Criação pública controlada de agendamentos e assinaturas.
- Permissão de atualização e cancelamento exclusiva para os donos dos dados e para o Administrador (`iurivonheldetatuador@gmail.com`).

---

## 📦 Comandos Git (Guia Completo)

### 1. Inicializar o Repositório Git Local
Se você baixou o projeto ou abriu no VS Code pela primeira vez:

```bash
# Inicializar o repositório Git no diretório do projeto
git init

# Adicionar todos os arquivos ao controle de versão
git add .

# Criar o primeiro commit
git commit -m "feat: versão inicial do aplicativo Ded Black Barbershop"
```

---

### 2. Conectar e Enviar para o GitHub

```bash
# Definir a branch principal como 'main'
git branch -M main

# Conectar ao seu repositório remoto no GitHub (substitua com o link do seu repositório)
git remote add origin https://github.com/SEU_USUARIO/ded-black-barbershop.git

# Enviar o código para o GitHub
git push -u origin main
```

---

### 3. Fluxo Diário de Trabalho com Git

#### Verificar o status dos arquivos alterados:
```bash
git status
```

#### Salvar novas alterações (Commit):
```bash
git add .
git commit -m "fix: ajuste visual e correção de regras de segurança"
git push
```

#### Baixar atualizações do repositório remoto:
```bash
git pull origin main
```

#### Criar uma nova branch para uma nova funcionalidade:
```bash
git checkout -b feature/nova-funcionalidade
```

---

## 📝 Licença

Este projeto é exclusivo da **Ded Black Barbershop**. Todos os direitos reservados.

## Produção: pré-requisitos obrigatórios

1. Configure Firebase Authentication (Google/Apple) e Firestore.
2. Configure credenciais do Firebase Admin SDK no backend usando Application Default Credentials ou `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `VITE_STRIPE_PUBLIC_KEY`. Em produção o checkout é bloqueado sem Stripe real.
4. Configure o endpoint `/api/webhooks/stripe` no Stripe e mantenha o webhook secret em segredo.
5. O fluxo PIX foi explicitamente bloqueado até existir integração real com um PSP; o sistema não aceita mais confirmação de pagamento declarada pelo navegador.
6. Crie/provisione o administrador no Firebase usando o e-mail definido por `ADMIN_EMAIL`. Não existe senha de administrador hardcoded.

### Validação local antes do deploy

```bash
npm install
npm run lint
npm run build
NODE_ENV=production npm start
```

> Não publique arquivos `.env`, service-account JSON ou chaves secretas no Git.
