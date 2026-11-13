# Guia do Ambiente Docker Local Isolado — PopoApp (Windows 11)

Este documento descreve como configurar, iniciar, operar e manter o ambiente Docker local 100% isolado do **PopoApp** no Windows 11 usando o **PowerShell**.

---

## 1. Visão Geral da Arquitetura e Isolamento

O ambiente Docker é composto por dois containers que se comunicam exclusivamente por uma rede interna isolada (`popoapp_internal`):

1. **`popoapp-sqlserver` (`sqlserver`)**:
   - Imagem oficial `mcr.microsoft.com/mssql/server:2022-latest` (Edição Express).
   - **Sem portas publicadas no Windows (`1433` não é exposta no host)**: evita qualquer conflito ou contato com instâncias SQL Server / LocalDB existentes na máquina.
   - Dados persistidos exclusivamente no volume Docker gerenciado `popoapp_sqlserver_data`.
2. **`popoapp-web` (`app`)**:
   - Aplicação Next.js 15 compilada e executada em modo de produção (`npm run build` + `npm start`) sobre `node:20-bookworm-slim`.
   - Publicada exclusivamente na interface de loopback local: **`127.0.0.1:3000:3000`** (acessível apenas na própria máquina via `http://localhost:3000`).
   - Anexos e fotos persistidos na pasta dedicada `./docker-data/uploads` no host (separada da pasta `./storage/uploads` usada fora do Docker).
3. **Política de Execução Manual (`restart: "no"`)**:
   - Nenhum container inicia sozinho com o Windows ou com o Docker Desktop. Você tem controle manual total sobre quando iniciar e parar.

---

## 2. Pré-requisitos no Windows 11

1. **Docker Desktop para Windows** instalado com backend **WSL 2** habilitado.
2. Antes de executar qualquer comando `docker`, abra o **Docker Desktop** manualmente e aguarde o ícone da baleia estabilizar (indicando *Engine running*).
3. Para confirmar no PowerShell se o Docker Desktop está pronto:
   ```powershell
   docker info
   ```

---

## 3. Configuração Inicial Privada (`.env.docker`)

O arquivo `.env.docker` na raiz do projeto contém todas as variáveis do ambiente Docker e já está protegido pelo `.gitignore` (regra `.env.*`). Seus arquivos `.env` e `.env.local` originais **nunca são lidos nem alterados** pelo Docker.

Abra o arquivo `.env.docker` no seu editor de texto e substitua os placeholders `CHANGE_ME_...`:

1. **`MSSQL_SA_PASSWORD`**:
   - Senha do usuário `sa` exclusiva para o SQL Server dentro do Docker.
   - Deve ter entre **8 e 128 caracteres**, combinando pelo menos **3 de 4 categorias** (maiúsculas, minúsculas, números e símbolos como `!`, `@`, `#`, `_`, `-`).
   - **Importante**: Evite os caracteres `;`, `"` e `$` para não interferir no parser da connection string.
2. **`DATABASE_URL`**:
   - Substitua `CHANGE_ME_STRONG_SQL_PASSWORD_123!` na string pela mesma senha definida em `MSSQL_SA_PASSWORD`.
3. **`SESSION_SECRET`**:
   - String aleatória com **no mínimo 32 caracteres** (exigido pelo `iron-session` para criptografia do cookie de sessão).
4. **`CRON_SECRET`**:
   - String secreta não-vazia (recomendado **32+ caracteres**) para autenticação do endpoint interno `/api/reminders/process-due`.
5. **`INITIAL_ADMIN_NICKNAME`, `INITIAL_ADMIN_DISPLAY_NAME` e `INITIAL_ADMIN_PASSWORD`**:
   - Defina o apelido de login (ex.: `admin`), o nome de exibição (ex.: `Administrador`) e a senha desejada para o seu primeiro usuário de acesso ao sistema no banco Docker.

> **Dica (PowerShell)**: Caso queira gerar segredos aleatórios de 48 caracteres no PowerShell para colar em `SESSION_SECRET` e `CRON_SECRET`:
> ```powershell
> -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
> ```

---

## 4. Comandos do Dia a Dia (PowerShell)

Execute todos os comandos abaixo na pasta raiz do projeto (`PopoApp`). Sempre inclua `--env-file .env.docker`.

### Iniciar o ambiente (subir containers em segundo plano)
> Na primeira execução, ou após alterações de código, adicione `--build` para construir a imagem da aplicação.
```powershell
docker compose --env-file .env.docker up -d --build
```
Nas próximas vezes em que quiser apenas iniciar os containers já construídos:
```powershell
docker compose --env-file .env.docker up -d
```

### Verificar o status dos containers
```powershell
docker compose --env-file .env.docker ps
```
- O container `popoapp-sqlserver` deve exibir `Up ... (healthy)`.
- O container `popoapp-web` deve exibir `Up ... 127.0.0.1:3000->3000/tcp`.

### Acessar a aplicação no navegador
Abra no navegador da própria máquina:
- **`http://localhost:3000`**

### Visualizar logs da aplicação Next.js (`app`)
```powershell
docker compose --env-file .env.docker logs -f app
```
*(Pressione `Ctrl + C` para sair da visualização de logs sem parar o container).*

### Visualizar logs do SQL Server (`sqlserver`)
```powershell
docker compose --env-file .env.docker logs -f sqlserver
```

### Parar o ambiente (preservando banco de dados e arquivos)
```powershell
docker compose --env-file .env.docker stop
```
Ou para parar e remover apenas os containers (mantendo o volume `popoapp_sqlserver_data` e os uploads intactos):
```powershell
docker compose --env-file .env.docker down
```

---

## 5. Inicialização do Banco de Dados Docker (Primeira Execução)

Quando os containers são iniciados pela primeira vez, o volume `popoapp_sqlserver_data` está vazio. Com os dois containers em execução (`up -d`), execute os dois passos abaixo:

### Passo 1: Criar o banco `PopoApp` e aplicar todas as migrações Prisma
```powershell
docker compose --env-file .env.docker exec app npx prisma migrate deploy
```
- Este comando conecta-se apenas ao container interno `sqlserver:1433`, cria o banco `PopoApp` automaticamente caso ainda não exista e aplica as migrações de `prisma/migrations/`.

### Passo 2: Criar o Usuário Inicial de Login (Opção B — Banco Limpo, Apenas 1 Usuário)
Para criar somente o seu usuário de login na tabela `[dbo].[User]` (lendo `INITIAL_ADMIN_NICKNAME`, `INITIAL_ADMIN_DISPLAY_NAME` e `INITIAL_ADMIN_PASSWORD` diretamente do seu `.env.docker`, sem popular dados fictícios de clientes/estoque):

```powershell
docker compose --env-file .env.docker exec app node -e 'const { PrismaClient } = require(`@prisma/client`); const bcrypt = require(`bcrypt`); (async () => { const p = new PrismaClient(); try { const nick = process.env.INITIAL_ADMIN_NICKNAME || `admin`; const name = process.env.INITIAL_ADMIN_DISPLAY_NAME || `Administrador`; const pass = process.env.INITIAL_ADMIN_PASSWORD; if (!pass || pass.startsWith(`CHANGE_ME`)) { throw new Error(`Defina INITIAL_ADMIN_PASSWORD no arquivo .env.docker antes de executar este comando.`); } const hash = await bcrypt.hash(pass, 10); const user = await p.user.upsert({ where: { nickname: nick }, update: { displayName: name, passwordHash: hash, isActive: true }, create: { nickname: nick, displayName: name, passwordHash: hash, isActive: true } }); console.log(`Usuario inicial configurado com sucesso:`, user.nickname); } finally { await p.$disconnect(); } })()'
```

Após essa mensagem de confirmação, acesse **`http://localhost:3000/login`** e entre com o `nickname` e a senha configurados em `.env.docker`.

---

## 6. Manutenção: Rebuild, Atualização de Código e Segredos

### Reconstruir a imagem após alterações no código-fonte ou `Dockerfile`
Para apenas reconstruir a imagem da aplicação:
```powershell
docker compose --env-file .env.docker build app
```
Ou para reconstruir e já subir/atualizar o container em seguida:
```powershell
docker compose --env-file .env.docker up -d --build app
```
Se uma nova migração Prisma tiver sido adicionada ao projeto, aplique-a em seguida:
```powershell
docker compose --env-file .env.docker exec app npx prisma migrate deploy
```

### Recriar o container da aplicação após editar variáveis no `.env.docker`
Se você alterar `SESSION_SECRET`, `CRON_SECRET` ou `INITIAL_ADMIN_*` no `.env.docker`, basta recriar o container `app` (não é necessário fazer rebuild da imagem):
```powershell
docker compose --env-file .env.docker up -d --force-recreate app
```

> **Atenção sobre alteração de `MSSQL_SA_PASSWORD`**:
> O SQL Server grava a senha do usuário `sa` dentro do volume `popoapp_sqlserver_data` apenas na primeira vez em que o volume é inicializado. Se desejar alterar a senha do `sa` posteriormente sem apagar o banco, altere-a primeiro dentro do SQL Server via `ALTER LOGIN [sa] WITH PASSWORD = '...'` e depois atualize `MSSQL_SA_PASSWORD` e `DATABASE_URL` no `.env.docker`.

---

## 7. Onde os Dados Ficam Armazenados

| Tipo de Dado | Localização | Persistência |
| :--- | :--- | :--- |
| **Banco de Dados SQL Server** (`PopoApp`) | Volume Docker nomeado `popoapp_sqlserver_data` (gerenciado pelo Docker Desktop / WSL 2 em `/var/opt/mssql` no container) | Persiste entre `stop`, `down`, rebuilds e reinicializações do Windows. |
| **Uploads e Fotos de Clientes/Atendimentos** | Pasta `./docker-data/uploads` na raiz do projeto (mapeada para `/app/storage/uploads` no container `app`) | Persiste diretamente no sistema de arquivos do Windows, isolada de `./storage/uploads`. |

> ⚠️ **AVISO CRÍTICO SOBRE EXCLUSÃO DE VOLUMES**:
> **NUNCA** execute `docker compose --env-file .env.docker down -v` a menos que você queira **APAGAR PERMANENTEMENTE** todo o banco de dados Docker (`popoapp_sqlserver_data`). A flag `-v` (`--volumes`) destrói o volume do SQL Server e todos os registros cadastrados nele. Para parar ou remover os containers com segurança, use sempre `docker compose --env-file .env.docker stop` ou `docker compose --env-file .env.docker down` (sem `-v`).

---

## 8. Solução de Problemas (Troubleshooting)

1. **Erro `error during connect: ... open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`**:
   - O Docker Desktop está fechado ou ainda está iniciando. Abra o aplicativo **Docker Desktop** no Windows, aguarde o motor Linux iniciar e tente novamente.
2. **Erro `Execute com --env-file .env.docker e defina ...`**:
   - Você executou `docker compose` sem informar `--env-file .env.docker`. Essa trava é intencional para garantir que o Docker Compose nunca leia o arquivo `.env` do ambiente local por engano.
3. **Container `popoapp-sqlserver` fica com status `unhealthy` ou reiniciando**:
   - Verifique os logs com `docker compose --env-file .env.docker logs sqlserver`.
   - A causa mais comum é uma senha `MSSQL_SA_PASSWORD` que não atende aos requisitos mínimos de complexidade do SQL Server 2022 (mínimo de 8 caracteres e pelo menos 3 tipos entre maiúsculas, minúsculas, dígitos e símbolos). Corrija a senha no `.env.docker`, remova o volume vazio recém-criado e suba novamente.
4. **Conflito na porta `3000` (`Bind for 127.0.0.1:3000 failed: port is already allocated`)**:
   - Verifique se você não deixou um servidor `npm run dev` rodando em outro terminal na porta `3000`. Pare o processo local na porta `3000` antes de iniciar o container `app`.
