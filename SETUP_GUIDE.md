# 🏥 PopoApp — Guia de Instalação e Configuração

> **PopoApp** é um sistema de gestão para clínicas estéticas, construído com Next.js 15, TypeScript, Prisma e SQL Server.

Este guia descreve **todos os passos necessários** para configurar o projeto em um novo computador após clonar o repositório remoto.

---

## 📋 Índice

1. [Pré-requisitos](#1--pré-requisitos)
2. [Instalar o Node.js](#2--instalar-o-nodejs)
3. [Instalar o Git](#3--instalar-o-git)
4. [Instalar o SQL Server LocalDB](#4--instalar-o-sql-server-localdb)
5. [Clonar o Repositório](#5--clonar-o-repositório)
6. [Instalar as Dependências do Projeto](#6--instalar-as-dependências-do-projeto)
7. [Configurar as Variáveis de Ambiente](#7--configurar-as-variáveis-de-ambiente)
8. [Configurar o Banco de Dados](#8--configurar-o-banco-de-dados)
9. [Executar o Projeto](#9--executar-o-projeto)
10. [Comandos Úteis](#10--comandos-úteis)
11. [Solução de Problemas](#11--solução-de-problemas)
12. [Stack Tecnológica](#12--stack-tecnológica)

---

## 1. 🖥️ Pré-requisitos

| Requisito               | Versão Mínima | Observação                                             |
| ------------------------ | ------------- | ------------------------------------------------------ |
| **Sistema Operacional**  | Windows 10+   | SQL Server LocalDB é exclusivo para Windows             |
| **Node.js**              | 18.x LTS      | Recomendado: 18.18.x ou superior                       |
| **npm**                  | 9.x+          | Já vem incluído na instalação do Node.js               |
| **Git**                  | 2.x+          | Para clonar o repositório                              |
| **SQL Server LocalDB**   | 2019+         | Banco de dados local (instância `MSSQLLocalDB`)        |

---

## 2. 📦 Instalar o Node.js

O Node.js é o runtime JavaScript necessário para executar o projeto. O **npm** (gerenciador de pacotes) já vem incluído.

### Opção A — Instalador oficial (recomendado)

1. Acesse: [https://nodejs.org/](https://nodejs.org/)
2. Baixe a versão **LTS** (18.x ou superior)
3. Execute o instalador e siga os passos (mantenha as opções padrão)
4. Verifique a instalação:

```bash
node --version
# Esperado: v18.x.x ou superior

npm --version
# Esperado: 9.x.x ou superior
```

### Opção B — Usando o NVM for Windows (gerenciamento de múltiplas versões)

1. Baixe o NVM for Windows em: [https://github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
2. Instale e execute:

```bash
nvm install 18
nvm use 18
```

---

## 3. 🔗 Instalar o Git

1. Acesse: [https://git-scm.com/downloads](https://git-scm.com/downloads)
2. Baixe e instale a versão para Windows
3. Durante a instalação, as opções padrão são suficientes
4. Verifique a instalação:

```bash
git --version
# Esperado: git version 2.x.x
```

---

## 4. 🗄️ Instalar o SQL Server LocalDB

O projeto utiliza o **Microsoft SQL Server LocalDB** como banco de dados. Ele é uma versão leve do SQL Server que roda localmente sem necessidade de configuração de servidor.

### Opção A — Instalar via SQL Server Express (recomendado)

1. Acesse: [https://www.microsoft.com/pt-br/sql-server/sql-server-downloads](https://www.microsoft.com/pt-br/sql-server/sql-server-downloads)
2. Baixe o **SQL Server Express** (gratuito)
3. Durante a instalação, selecione a opção **"Custom"** ou **"Baixar mídia"**
4. No instalador, marque a feature **"LocalDB"**
5. Conclua a instalação

### Opção B — Instalar apenas o LocalDB (standalone)

```bash
# Se você tiver o Visual Studio Installer:
# Abra o Visual Studio Installer → Modifique sua instalação
# Marque: "SQL Server Express LocalDB" em Componentes Individuais
```

### Verificar a instalação

```bash
sqllocaldb info
# Esperado: lista as instâncias, deve incluir "MSSQLLocalDB"

sqllocaldb info MSSQLLocalDB
# Mostra o status da instância
```

Se a instância `MSSQLLocalDB` não existir, crie-a:

```bash
sqllocaldb create MSSQLLocalDB
sqllocaldb start MSSQLLocalDB
```

### (Opcional) Instalar o SQL Server Management Studio (SSMS)

Para visualizar e gerenciar o banco de dados com interface gráfica:

1. Acesse: [https://learn.microsoft.com/pt-br/sql/ssms/download-sql-server-management-studio-ssms](https://learn.microsoft.com/pt-br/sql/ssms/download-sql-server-management-studio-ssms)
2. Baixe e instale o SSMS
3. Conecte usando o servidor: `(localdb)\MSSQLLocalDB`

---

## 5. 📥 Clonar o Repositório

```bash
# Substitua <URL_DO_REPOSITÓRIO> pela URL real do repositório Git
git clone <URL_DO_REPOSITÓRIO>
cd PopoApp
```

---

## 6. 📚 Instalar as Dependências do Projeto

Dentro da pasta do projeto, execute:

```bash
npm install
```

Isso irá instalar todas as dependências listadas no `package.json`, incluindo:

- **Next.js 15** — Framework React full-stack
- **Prisma 6** — ORM para o banco de dados
- **React 19** — Biblioteca de UI
- **Tailwind CSS** — Framework de estilos
- **shadcn/ui** — Componentes de interface (Radix UI)
- **iron-session** — Gerenciamento de sessões
- **bcrypt** — Criptografia de senhas
- E muitas outras (veja `package.json` para a lista completa)

> ⏱️ Este processo pode levar alguns minutos na primeira execução.

---

## 7. 🔐 Configurar as Variáveis de Ambiente

O projeto precisa de variáveis de ambiente para funcionar. Um arquivo de exemplo está disponível.

### Copiar o arquivo de exemplo

```bash
# Windows (CMD)
copy .env.example .env
copy .env.example .env.local

# Windows (PowerShell)
Copy-Item .env.example .env
Copy-Item .env.example .env.local
```

### Editar os valores

Abra os arquivos `.env` e `.env.local` em um editor de texto e preencha:

```env
# Conexão com o SQL Server LocalDB (geralmente funciona sem alterações)
DATABASE_URL="sqlserver://localhost;database=PopoApp;integratedSecurity=true;trustServerCertificate=true;instanceName=MSSQLLocalDB"

# Chave secreta para encriptação das sessões (mínimo 32 caracteres)
# Gere uma chave aleatória, por exemplo:
#   No PowerShell: -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
#   Ou use: https://generate-secret.vercel.app/32
SESSION_SECRET="sua-chave-secreta-com-pelo-menos-32-caracteres"

# Ambiente de desenvolvimento
NODE_ENV="development"
```

> **Importante:** Os arquivos `.env` e `.env.local` contêm dados sensíveis e **NÃO devem** ser commitados no Git (já estão no `.gitignore`).

---

## 8. 🗃️ Configurar o Banco de Dados

### 8.1 Verificar que o LocalDB está rodando

```bash
sqllocaldb start MSSQLLocalDB
```

### 8.2 Gerar o Prisma Client

```bash
npx prisma generate
```

### 8.3 Criar o banco de dados e aplicar o schema

```bash
# Sincroniza o schema Prisma com o banco de dados (cria o banco e as tabelas)
npx prisma db push
```

### 8.4 Popular o banco de dados com dados iniciais (seed)

```bash
npm run db:seed
```

Isso cria o usuário administrador padrão:

| Campo    | Valor           |
| -------- | --------------- |
| Usuário  | `admin`         |
| Senha    | `PopoApp2024!`  |

> ⚠️ **Atenção:** Altere a senha padrão do administrador em ambiente de produção!

### (Opcional) Visualizar o banco de dados com Prisma Studio

```bash
npm run db:studio
```

Isso abre uma interface web em `http://localhost:5555` para visualizar e editar dados no banco.

---

## 9. 🚀 Executar o Projeto

### Modo Desenvolvimento (com hot-reload)

```bash
npm run dev
```

O aplicativo estará disponível em: **[http://localhost:3000](http://localhost:3000)**

### Login Padrão

- **Usuário:** `admin`
- **Senha:** `PopoApp2024!`

### Modo Produção

```bash
# 1. Gerar a build de produção
npm run build

# 2. Iniciar o servidor de produção
npm start
```

---

## 10. 🛠️ Comandos Úteis

| Comando                | Descrição                                        |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Inicia o servidor de desenvolvimento             |
| `npm run build`        | Gera a build de produção                         |
| `npm start`            | Inicia o servidor de produção                    |
| `npm run lint`         | Verifica erros de linting (ESLint)               |
| `npm run db:generate`  | Regenera o Prisma Client                         |
| `npm run db:migrate`   | Aplica as migrations do Prisma                   |
| `npm run db:seed`      | Popula o banco com dados iniciais                |
| `npm run db:studio`    | Abre o Prisma Studio (interface visual do banco) |
| `npx prisma db push`   | Sincroniza o schema com o banco de dados         |

---

## 11. 🔧 Solução de Problemas

### ❌ Erro: `sqllocaldb` não é reconhecido como comando

O SQL Server LocalDB não está instalado ou não está no PATH. Reinstale seguindo o [Passo 4](#4--instalar-o-sql-server-localdb).

### ❌ Erro: `Cannot find module '@prisma/client'`

Execute o Prisma generate:

```bash
npx prisma generate
```

### ❌ Erro de conexão com o banco de dados

1. Verifique se o LocalDB está rodando:
   ```bash
   sqllocaldb start MSSQLLocalDB
   ```
2. Verifique se a `DATABASE_URL` no `.env` está correta
3. Certifique-se de que a instância `MSSQLLocalDB` existe:
   ```bash
   sqllocaldb info
   ```

### ❌ Erro: `ts-node` não encontrado ao rodar o seed

Instale o ts-node globalmente ou verifique se está nas devDependencies:

```bash
npm install -D ts-node
```

### ❌ Erro: Porta 3000 já está em uso

Outra aplicação está usando a porta. Encerre-a ou inicie o Next.js em outra porta:

```bash
npx next dev -p 3001
```

### ❌ Erro: `bcrypt` falha ao instalar (problemas de compilação nativa)

O bcrypt requer ferramentas de build nativas. Instale:

```bash
npm install --global windows-build-tools
```

Ou instale o Visual Studio Build Tools com o workload "Desenvolvimento para desktop com C++".

---

## 12. 📊 Stack Tecnológica

| Camada          | Tecnologia                                    |
| --------------- | --------------------------------------------- |
| **Framework**   | Next.js 15 (App Router)                       |
| **Linguagem**   | TypeScript 5.6                                |
| **UI**          | React 19                                      |
| **Estilos**     | Tailwind CSS 3.4 + PostCSS + Autoprefixer     |
| **Componentes** | shadcn/ui (Radix UI + CVA + tailwind-merge)   |
| **Banco**       | Microsoft SQL Server (LocalDB)                |
| **ORM**         | Prisma 6                                      |
| **Autenticação**| iron-session 8 + bcrypt                       |
| **Formulários** | React Hook Form 7 + Zod                       |
| **Animações**   | Framer Motion 11                              |
| **Ícones**      | Lucide React                                  |
| **Notificações**| Sonner                                        |
| **Datas**       | date-fns 4                                    |
| **Idioma**      | Português (pt-BR)                             |

---

## 📝 Resumo Rápido (TL;DR)

```bash
# 1. Clone o repositório
git clone <URL_DO_REPOSITÓRIO>
cd PopoApp

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
copy .env.example .env
copy .env.example .env.local
# Edite os arquivos e preencha SESSION_SECRET

# 4. Inicie o LocalDB
sqllocaldb start MSSQLLocalDB

# 5. Configure o banco de dados
npx prisma generate
npx prisma db push
npm run db:seed

# 6. Inicie o projeto
npm run dev

# 7. Acesse http://localhost:3000
# Login: admin / PopoApp2024!
```

---

> **Dúvidas?** Consulte a documentação oficial das tecnologias:
> - [Next.js](https://nextjs.org/docs)
> - [Prisma](https://www.prisma.io/docs)
> - [Tailwind CSS](https://tailwindcss.com/docs)
> - [shadcn/ui](https://ui.shadcn.com)
