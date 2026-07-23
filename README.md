# 📦 LOGISTIC.IO — Quality Logistics Platform

Uma plataforma full-stack moderna de gestão logística integrada, desenvolvida sob medida para a **Quality Logistics**. O sistema automatiza o fluxo completo de recebimento de mercadorias (**Warehouse Receipts - WR**), consolidação de cargas, emissão de **Bills of Lading (BL)**, gerenciamento de parceiros (*Shippers* e *Consignees*) com múltiplas plantas, e integração com inteligência artificial para extração e validação de informações.

---

## 🚀 Visão Geral e Arquitetura

O sistema adota uma arquitetura full-stack integrada (**Vite + Express + Firebase Firestore**), assegurando segurança no tráfego de chaves e alta performance de processamento local combinada com persistência em nuvem.

### 🛠️ Stack Tecnológica
*   **Frontend**: React (v18) com TypeScript, Vite e Tailwind CSS.
*   **Animações**: Framer Motion (`motion/react`) para transições suaves de abas e modais.
*   **Backend**: Node.js com Express para orquestração de APIs, gerenciamento de payloads e proxies de segurança.
*   **Banco de Dados**: Firestore (Firebase Admin SDK) para persistência global em nuvem estruturada + cache síncrono em arquivo JSON local (`data/db.json`) para inicialização ultrarrápida.
*   **Inteligência Artificial**: SDK oficial `@google/genai` utilizando modelos Gemini no servidor para extração inteligente de dados (OCR de trackings e labels).
*   **Geração de Documentos**: PDFs customizados renderizados diretamente na interface para impressão física ou digital.

---

## 📂 Estrutura de Arquivos e Caminhos (Paths)

Abaixo está a organização e os caminhos dos principais componentes e serviços da plataforma:

```bash
├── data/
│   └── db.json                         # Cache local do banco de dados (fallback síncrono)
├── public/
│   └── uploads/                        # Armazenamento local de imagens/documentos das cargas
├── src/
│   ├── App.tsx                         # Orquestrador de rotas de abas, modos escuro/claro e controle de unidades
│   ├── types.ts                        # Definições globais de interfaces TypeScript (User, Receipt, Item, Shipper, BL, etc.)
│   ├── firebase.ts                     # Configurações do SDK do Firebase cliente
│   ├── index.css                       # Estilos globais e configurações de temas do Tailwind CSS
│   ├── components/                     # Componentes visuais e modais da interface
│   │   ├── Login.tsx                   # Tela de login com suporte a credenciais locais e Google Auth
│   │   ├── Dashboard.tsx               # Painel estatístico, busca de recibos, relatórios e visualizações rápidas
│   │   ├── WarehouseReceiptForm.tsx    # Formulário dinâmico de recebimento de cargas (múltiplos itens, fotos, IA)
│   │   ├── WarehouseReceiptPDF.tsx     # Template do documento PDF oficial de recebimento (Warehouse Receipt)
│   │   ├── BillOfLadingList.tsx        # Consolidador e gerador de despachos de Bills of Lading
│   │   ├── BillOfLadingPDF.tsx         # Template do documento PDF de despacho de cargas (Bill of Lading)
│   │   ├── ShipperManager.tsx          # Gestor de Shippers (Exportadores) e suas respectivas plantas
│   │   ├── ConsigneeManager.tsx        # Gestor de Consignees (Destinatários) e suas respectivas plantas
│   │   └── DeleteConfirmationModal.tsx # Confirmação de segurança para exclusão de registros
│   └── services/
│       └── api.ts                      # Serviço cliente que abstrai as chamadas HTTP para o servidor Express
├── server.ts                           # Servidor Express, inicialização de Firestore, limpeza de arquivos e endpoints API
├── firebase-blueprint.json             # Estrutura lógica do esquema e propriedades do banco de dados
├── firestore.rules                     # Regras de segurança de acesso ao banco de dados Firestore
├── metadata.json                       # Configurações de permissões do iFrame e metadados da aplicação
└── .env.example                        # Variáveis de ambiente necessárias para o funcionamento da plataforma
```

---

## ✨ Principais Funcionalidades

### 1. Sistema Dinâmico de Unidades (US & Europe)
A aplicação possui um comutador global de unidades em tempo real, alterando instantaneamente o visual e o cálculo das propriedades das cargas nas interfaces e nos PDFs emitidos:
*   **Unidade US (🇺🇸 US)**: Comprimento/Largura/Altura em **Polegadas (in)**, peso em **Libras (Lbs)** e volume em **Pés Cúbicos (Cft)**.
*   **Unidade Europeia (🇪🇺 Europe)**: Comprimento/Largura/Altura em **Centímetros (cm)**, peso em **Quilos (Kgs)** e volume em **Metros Cúbicos (Cbm)**.
*   **Conversão Automática**: O sistema calcula automaticamente o peso volumétrico das cargas usando os fatores de conversão padrão internacional da indústria logística.

### 2. Entrada de Cargas (Warehouse Receipts)
Formulário avançado e robusto focado em precisão para operadores de pátio:
*   **Múltiplas Fotos**: Registro de fotos da carga via upload local ou diretamente através de captura ao vivo por **Live Webcam**.
*   **IA & OCR Inteligente**: Integração síncrona com o Gemini AI para analisar as fotos e extrair automaticamente números de rastreamento (*Tracking Numbers*) ou preencher campos estruturados de etiquetas de carga diretamente.
*   **Validação Humana Pós-IA (Human-in-the-Loop)**: Como boa prática de engenharia de inteligência artificial e robustez de processos operacionais, todos os dados extraídos pelo motor de IA **não são gravados diretamente de forma cega**. A plataforma apresenta o rascunho de preenchimento estruturado de forma interativa na tela, permitindo que o operador de pátio revise, faça ajustes e corrija eventuais falhas de OCR ou alucinações de caracteres, confirmando manualmente a gravação definitiva apenas após a validação humana.
*   **Itens Detalhados**: Cadastro individual por item com quantidade, dimensões, peso, tipo de volume, localização/bin e **Condição Individual da Carga** (e.g., *No seal*, *blurry seal*, *broken pallet*, *plastic*, *fumigated*, entre outros).

### 3. Emissão de Bills of Lading (BL)
Permite a consolidação de múltiplas cargas para envio definitivo:
*   Associação dinâmica de múltiplos Warehouse Receipts a um único Bill of Lading.
*   Alteração automática do status dos recibos associados de `RECEBIDO` para `DESPACHADO`. Se o BL for alterado ou removido, o status das cargas é devolvido para `RECEBIDO` de forma resiliente no banco de dados.

### 4. Gerenciamento de Shipper e Consignee
*   Cadastro completo de parceiros logísticos corporativos.
*   Suporte para **múltiplas plantas de fabricação/entrega** associadas ao mesmo parceiro, cada uma contendo seu próprio endereço, telefone e e-mail de contato individualizado.

---

## ☁️ Persistência de Dados e Firestore (Resiliência & Sincronização)

O sistema implementa uma camada híbrida de persistência projetada para máxima tolerância a falhas e consistência de dados, mitigando de forma robusta os riscos de divergência (*Split-Brain*):
1.  **Definição Estrita da Fonte da Verdade (SSOT)**: O **Firestore** é eleito como o mestre indiscutível e autoritativo de todos os dados operacionais globais.
2.  **Cache para Inicialização e Leitura Rápida**: O arquivo físico local `data/db.json` serve prioritariamente como cache síncrono de leitura rápida para otimizar a velocidade de inicialização do servidor e manter respostas de milissegundos para os usuários.
3.  **Estratégia Avançada de Merge Bidirecional Last-Write-Wins (LWW)**:
    Na inicialização do servidor, realiza-se uma reconciliação automática e robusta de conflitos entre a base local (`data/db.json`) e a base em nuvem (Firestore) baseada na estratégia **Last-Write-Wins**:
    *   **Função de Auditoria de Modificação (`getModifiedTime`)**: Extrai e valida de forma resiliente as marcas de data mais recentes de cada registro, analisando os metadados `updatedAt` -> `createdAt` -> `acceptedAt` -> `timestamp` para determinar com precisão microssegunda a idade lógica do documento.
    *   **LWW Direcional (Local Wins)**: Se o registro modificado localmente possuir um carimbo de modificação estritamente superior ao carimbo do Firestore correspondente (`localTime > firestoreTime`), a versão local sobrescreve a versão da nuvem. O sincronizador em segundo plano empurra automaticamente essa atualização para o Firestore.
    *   **LWW Direcional (Firestore Wins)**: Se o registro na nuvem for mais recente (`localTime < firestoreTime`), a versão do Firestore sobressai. Qualquer marcação de pendência local antiga (`synced: false`) é eliminada para evitar sobrescrever dados válidos futuros.
    *   **Garantia de Identidade e Sincronia**: Se os carimbos forem equivalentes, a versão canônica do Firestore é mantida e limpa-se qualquer marcação provisória de dessincronização local.
    *   **Criações em Modo Offline**: Itens novos gerados localmente que ainda não possuam correspondente no Firestore são preservados integralmente com marcação de sincronia pendente (`synced: false`) e enfileirados para envio.
4.  **Consistência de Carimbo Universal (Universal Timestamping)**:
    Todas as ações realizadas no sistema geram e atualizam de forma estrita a propriedade `updatedAt` como string ISO 8601 UTC. Isso engloba:
    *   Criação e edição de *Shippers* e *Consignees* (incluindo gerenciamento de plantas).
    *   Entrada, edição, soft-delete e restauração de *Warehouse Receipts*.
    *   Criação, soft-delete e restauração de *Bills of Lading (BL)*.
    *   Criação e atualização de *Tenants*, *Invitations* e registros de *Usuários*.
5.  **Fila de Sincronização e Resiliência de Rede (Queue & Retry)**:
    *   **Fila de Exclusão Pendente (Deletions)**: Exclusões de registros solicitadas durante períodos offline são enfileiradas de forma durável na propriedade `pendingDeletions` dentro de `data/db.json` e aplicadas localmente, limpando os registros em background assim que a rede se restabelecer.
    *   **Sincronizador Automático em Background**: Um processo periódico leve em segundo plano no servidor roda a cada 30 segundos, verificando os registros com marcas pendentes (`synced: false` ou `pendingDeletions`) e executando de maneira transparente o reenvio automático (*retry*) ao Firestore assim que a estabilidade do link é restaurada.

---

## 🔒 Segurança de Upload e Robustez de Mídia

Para blindar o servidor e os recursos físicos de armazenamento contra tentativas de ataques cibernéticos por meio de uploads maliciosos, implementamos uma barreira rígida de validação de mídia:
1.  **Validação Rígida por Bytes Mágicos (Magic Bytes)**: O servidor não confia exclusivamente na extensão informada no cabeçalho ou no payload Base64 recebido. Realizamos a leitura e análise de assinaturas de cabeçalho binário dos arquivos (ex: assinaturas `FF D8 FF` para JPEGs, `89 50 4E 47` para PNGs e assinaturas de bloco de formato `RIFF`/`WEBP`), garantindo o tipo de mídia real e rejeitando anexos camuflados.
2.  **Limite Estrito de Tamanho por Arquivo**: Aplicamos um filtro de tamanho severo que restringe o recebimento a no máximo **5MB por foto**, evitando ataques de exaustão de disco e otimizando o transporte de rede.
3.  **Renomeação Robusta com UUID v4**: Os arquivos salvos localmente recebem nomes aleatórios universais gerados via algoritmos de hash (UUID v4), prevenindo a adivinhação de recursos por terceiros.
4.  **Bloqueio contra Travessia de Diretório (Anti-Path Traversal)**: Todos os nomes de arquivos passam por uma rotina estrita de sanitização que expurga sequências maliciosas como `..`, `/` ou caracteres especiais que pudessem ser injetados para tentar forçar o salvamento ou a leitura de arquivos fora do diretório `/uploads/` do servidor.

---

## 🔑 Controle de Acesso Baseado em Papéis de Dois Níveis (RBAC) e Segurança

O sistema implementa um modelo moderno de autorização e segurança corporativa, eliminando dependências de e-mails hardcoded e incorporando controle granular de exclusão e trilhas de auditoria:

### 1. Níveis de Autorização em Camada Dupla
*   **Papéis no Nível de Tenant (`tenantRole`)**:
    *   **Proprietário (`owner`)**: Dono da conta do cliente (Tenant) na plataforma. Possui controle total sobre os dados de sua empresa, visualização da lixeira ("Itens Excluídos") e privilégios exclusivos para realizar **Exclusão Suave (Soft Delete)** e restauração de seus próprios registros.
    *   **Administrador (`admin`)**: Gerente operacional do pátio logístico. Pode criar, atualizar e visualizar registros, mas não possui permissões para deletar ou restaurar dados.
    *   **Operador (`operator`)**: Usuário de pátio focado em entrada e despacho de cargas. Sem privilégios de deleção ou configurações sensíveis.
*   **Papéis no Nível de Plataforma (`platformRole`)**:
    *   **Super Administrador (`superadmin`)**: Papel detido pelo desenvolvedor e equipe de suporte do SaaS. Permite contornar restrições de tenant para fins de suporte, restaurar registros de qualquer organização, realizar **Expurgo Físico (Hard Delete)** definitivo do banco de dados e gerenciar os Tenants globais.

### 2. Arquitetura de Exclusão Suave (Soft Delete) e Lixeira
Em substituição às deleções permanentes imediatas, todos os registros de Shippers, Consignees, Warehouse Receipts e Bills of Lading são submetidos a um ciclo de vida resiliente:
*   **Soft Delete**: Quando um `owner` solicita a exclusão, o registro é marcado com metadados de exclusão (`deletedAt` e `deletedBy`) e movido para a **Lixeira (Itens Excluídos)**, desaparecendo imediatamente das listagens operacionais padrão.
*   **Janela de Retenção de 30 Dias**: Itens na lixeira permanecem protegidos por 30 dias. Proprietários (`owner`) do tenant de origem podem clicar em "Restaurar" a qualquer momento para desfazer a ação.
*   **Rotina de Limpeza Automática (Auto-Purge)**: Uma rotina em segundo plano (cronjob) é executada a cada 12 horas no backend, identificando e expurgando fisicamente do banco de dados qualquer item com `deletedAt` superior a 30 dias de forma automatizada e definitiva.

### 3. Trilhas de Auditoria (Audit Logging)
Todas as operações críticas de soft-delete, restauração e expurgo físico geram entradas imutáveis de log na coleção de auditoria (`auditLog` no Firestore e cache local), registrando:
*   Ação realizada (ex: `SOFT_DELETE`, `RESTORE`, `PURGE`).
*   ID e tipo do recurso afetado.
*   E-mail e UID do usuário autor da ação.
*   Identificador do Tenant.
*   Timestamp UTC exato do evento.

### 4. Validação Humana Pós-IA (Human-in-the-Loop)
Como boa prática de engenharia de inteligência artificial e robustez de processos operacionais, todos os dados extraídos pelo motor de IA (leitura de trackings, volumes e dados de etiquetas por OCR do Gemini) **não são gravados diretamente de forma cega**. 
A plataforma apresenta um rascunho interativo de preenchimento estruturado na tela, obrigando o operador a revisar os campos analisados, fazer correções manuais de caracteres e aprovar as informações antes do salvamento definitivo.

### 5. Regra de Retenção Estendida e Arquivamento Frio (Cold Archiving Gzip)
Em conformidade com as regras internacionais e melhores práticas da indústria logística para disputas de cargas, as fotos de cargas originais recebidas há mais de **180 dias** são comprimidas via algoritmo **Gzip** para o diretório frio do servidor (`/public/uploads/archive/*.gz`) para economizar espaço físico, preservando o histórico operacional de disputas intacto e referenciado como `"ARCHIVED"` no banco de dados.

### 6. Fluxo de Onboarding por Convites (SaaS Multi-tenant)
Para expandir o software para o modelo SaaS com segurança, implementamos um fluxo de onboarding estritamente baseado em convites (eliminando autoregistro público):
1. **Superadmin (Nós/Dono do SaaS)**: Registra no painel a nova empresa cliente (ex: *Quality Logistics* com o domínio `qualitylogistics.com`) e gera o convite para o e-mail do dono da empresa (`mariana.qualitylogistics@gmail.com`) com papel de `owner` (Proprietário).
2. **Onboarding do Proprietário (Owner)**: Mariana acessa o link seguro recebido, faz o login social com a sua Conta Google e o sistema a vincula automaticamente à sua empresa de forma segura com o papel `owner`.
3. **Gerenciamento de Equipe e Convites**: No menu "Gerenciar Equipe", Mariana (como proprietária) pode convidar seus operadores de pátio ou gerentes digitando o e-mail Google deles e escolhendo seu papel correspondente (`operator` ou `admin`).
4. **Onboarding da Equipe**: O convidado recebe um link seguro exclusivo (ex: `/?invite=invite-123`). Ao clicar e entrar com o Google Auth, o sistema aceita o convite e o credencia automaticamente na empresa correta com o papel pré-estabelecido de forma transparente e imediata.

### 7. Interface SaaS & Controle de Papéis Multi-tenant (RBAC UI/UX)
Para garantir uma experiência de uso extremamente profissional e aderente aos requisitos regulatórios, a plataforma implementa visões dedicadas e adaptadas automaticamente ao nível de permissão do usuário autenticado:
*   **🔧 Superadmin (Modo Deus - Equipe SaaS)**:
    *   **Seletor de Tenant**: Dropdown fixado no topo da barra de navegação principal que permite "entrar" na conta de qualquer empresa cadastrada (impersonificação segura por injeção do header HTTP `X-Selected-Tenant-Id` nas chamadas API).
    *   **Dashboard da Plataforma**: Painel de métricas agregadas fora de contexto de tenants (total de empresas ativas, usuários cadastrados, recibos gerados e volume consolidado de storage em nuvem).
    *   **Painel de Auditoria Global**: Rastreabilidade unificada que lista logs imutáveis de todas as ações sensíveis (exclusões, convites, restaurações) executadas no ecossistema por qualquer organização.
    *   **Lixeira Global**: Permite que a equipe de suporte do SaaS visualize todos os itens com soft-delete do sistema e execute restaurações assistidas ou purgas físicas definitivas do Firestore (Hard Delete).
    *   **Gestão de Clientes**: Formulário para criar novas empresas (definição de nome, domínio de e-mail corporativo, plano de faturamento e política de retenção estendida).
*   **👑 Owner (Proprietário da Empresa)**:
    *   Painel administrativo completo isolado para sua organização específica.
    *   **Gerenciamento de Equipe**: Formulário de convites e listagem de operadores e administradores vinculados ao tenant.
    *   **Lixeira do Tenant**: Acesso exclusivo à lixeira local para restauração rápida de dados ou relatórios.
*   **🛡️ Admin (Gerente Operacional)**:
    *   Acesso total ao fluxo operacional logístico: criação e edição de Shippers, Consignees, plantas de entrega, recibos e consolidação de BLs.
    *   **Segurança de Dados**: Totalmente bloqueado de acessar o gerenciador de equipe ou realizar exclusões de registros.
*   **👷 Operator (Operador de Pátio)**:
    *   Interface minimalista e focada exclusivamente no dia a dia.
    *   **Foco Total**: Acesso exclusivo aos formulários de entrada de cargas (`WarehouseReceiptForm`), consulta rápida e cadastro ágil de shippers e consignees para acelerar as operações no pátio físico.

---

## 🔒 Auditoria de Produção, Segurança e Performance (Relatório Completo)

Este relatório formal atesta as capacidades reais de segurança, observabilidade e escala do sistema implementado, organizando os 10 pontos críticos de auditoria de produção entre os recursos de código já ativos no ecossistema e as melhores recomendações de infraestrutura para produção comercial.

### 🛡️ 1. Recursos Ativos e Implementados no Código

#### 1. Rate Limiting em Memória (IP & Email)
*   **Status**: ✅ **Implementado e ativo.**
*   **Abordagem**: Implementação robusta de **Rate Limiting em memória** diretamente no `server.ts` para mitigar abuso das rotas e requisições do Gemini. O mecanismo utiliza dois mapas internos (`ipLimitStore` e `userLimitStore`) e purga registros obsoletos de forma autônoma a cada 5 minutos (`setInterval`). Ele analisa de forma resiliente o IP real do cliente verificando o cabeçalho `X-Forwarded-For` para suportar proxies reversos do Cloud Run.
*   **Limites Configurados**:
    *   **APIs do Gemini (`/api/gemini/*`):** Máximo de **10 requisições por IP** e **5 por e-mail de usuário** autenticado por minuto.
    *   **APIs de Upload/Escrita (`/api/receipts` POST/PUT):** Máximo de **15 requisições por IP** e **10 por e-mail de usuário** autenticado por minuto (via `uploadRateLimiter`).

#### 2. Validação Binária de Magic Bytes (Segurança de Upload)
*   **Status**: ✅ **Implementado e ativo.**
*   **Abordagem**: O sistema não confia em cabeçalhos do navegador ou extensões de arquivos enviadas pelo cliente. Toda carga de mídia base64 ou upload é decodificada diretamente em um Node.js `Buffer` no backend, onde passa pela verificação de bytes mágicos no cabeçalho binário real do arquivo (`verifyBufferMagicBytes`):
    *   **JPEG (`image/jpeg`):** Verifica se inicia com `FF D8 FF`.
    *   **PNG (`image/png`):** Verifica se inicia com `89 50 4E 47`.
    *   **WebP (`image/webp`):** Valida a assinatura `RIFF` nos offsets 0-3 e a palavra `WEBP` nos offsets 8-11.
    *   **PDF (`application/pdf`):** Confere a assinatura `%PDF` (`25 50 44 46`).

#### 3. Regras de Isolamento Multitenant (Firestore Rules)
*   **Status**: ✅ **Implementado e ativo.**
*   **Abordagem**: Nossas regras de segurança do Firestore (`firestore.rules`) garantem isolamento no nível de banco de dados por meio de controle baseado em atributos (ABAC), consultando o documento `/users/$(request.auth.uid)` e impedindo que requisições leiam ou escrevam dados de outros tenants ou empresas. Unificamos o tratamento do atributo herdado `isGlobalAdmin` com `platformRole` para garantir imunidade contra inconsistências de privilégios.

#### 4. Prevenção Estrita de Vazamento de Secrets
*   **Status**: ✅ **Implementado e ativo.**
*   **Abordagem**: A chave privada `GEMINI_API_KEY` é consumida estritamente de forma segura no lado do servidor em `server.ts`. Nenhuma chave privada ou configuração sensível de backend vaza no empacotamento estático do cliente (`/dist`), uma vez que o Vite está configurado para expor apenas variáveis prefixadas com `VITE_`.

#### 5. Compactação Fria Automática (TTL de 180 dias Gzip)
*   **Status**: ✅ **Implementado e ativo.**
*   **Abordagem**: A cada 12 horas, rotinas de varredura automatizadas no backend compactam fotos antigas (acima de 180 dias) em formato `.gz` e as migram para o repositório frio de arquivamento para compliance e proteção contra custos excessivos de armazenamento, mantendo os dados textuais e relatórios de pesagem intocados.

---

### 🚀 2. Recomendações e Diretrizes para Infraestrutura de Produção

As práticas e configurações recomendadas a seguir destinam-se ao planejamento do ambiente de produção comercial e devem ser implementadas no console do Google Cloud Platform (GCP) pela equipe de engenharia DevOps:

#### 1. Migração de Armazenamento Local para Google Cloud Storage (GCS)
*   **Status**: 🟡 **Recomendado para Produção Conteinerizada (Cloud Run).**
*   **Diretriz**: Como os contêineres do Cloud Run são efêmeros e apagam arquivos locais a cada reinicialização ou ciclo de escalabilidade automática, as mídias salvas em `/public/uploads` devem ser apontadas para um Bucket privado do Google Cloud Storage (GCS) utilizando a SDK de Storage do Google Cloud para persistência durável e integrada.

#### 2. Backups Periódicos do Banco de Dados Firestore
*   **Status**: 🟡 **Recomendado para Compliance Corporativo.**
*   **Diretriz**: É recomendável criar uma política de backup automatizada diária. Configure um job cron no **Cloud Scheduler** chamando o serviço nativo de exportação do Firestore Admin API para arquivar os backups do banco de dados em um bucket frio (GCS) com política de expiração física (*Lifecycle Rule*) de 30 dias.

#### 3. Alertas de Orçamento e Limitação de Cotas do Gemini
*   **Status**: 🟡 **Recomendado para Proteção de Cobranças.**
*   **Diretriz**: Configure alertas de orçamento (*GCP Budget Alerts*) no painel do Google Cloud Billing (com notificações em 50%, 80% e 100% de uso estimado), além de impor limites máximos de requisições por minuto (RPM) no console da API do Google para se proteger de ataques de negação de carteira (*Denial of Wallet*).

#### 4. Observabilidade e Monitoramento de Performance (Cloud Logging)
*   **Status**: 🟡 **Recomendado para Auditoria de Latência.**
*   **Diretriz**: Implemente monitoramento de tempos de resposta das rotas da API do Gemini (`/api/gemini/*`) em produção mapeando os registros para o **Google Cloud Logging** e estruturando alertas gráficos no Grafana ou Google Cloud Monitoring para acompanhamento das taxas de requisições logísticas.

#### 5. Ciclo de Deploy Sem Queda (Blue-Green Deployment)
*   **Status**: 🟡 **Nativo do Cloud Run.**
*   **Diretriz**: Aproveite os recursos nativos do Google Cloud Run para gerenciar novos deploys em produção. No caso de reversões rápidas de emergência (*rollback*), o tempo de restauração é inferior a 10 segundos ao apontar 100% do tráfego para a revisão estável anterior diretamente pelo painel do GCP.taxas de faturamento.
    *   No nível do banco de dados, o Firestore escala de forma elástica e transparente, mas as leituras cruzadas em regras de segurança (`get()` lookups) podem acumular requisições de faturamento. Para grande escala, as sessões de usuários ou tokens customizados de autenticação podem carregar reivindicações de tenant (*custom claims*) para evitar acessos repetidos ao documento do usuário.

#### 10. Rollback e Deploy de Emergência
*   **Status**: ✅ **Deploy Azul-Verde nativo via Cloud Run.**
*   **Estratégia**: O Cloud Run gerencia o ciclo de vida e versionamento de contêineres de forma autônoma. Em caso de quebra em produção, o tempo de rollback é de **menos de 10 segundos**, bastando apontar 100% do tráfego para a revisão estável anterior por meio de comando gcloud ou painel GCP, sem necessidade de recompilar ou gerar novas imagens Docker.

---

## 🔑 Chaves do Sistema e Configurações de Exportação

Para apoiar as equipes de engenharia, implantação e operação, abaixo está a documentação completa de todas as chaves de configuração, segredos de ambiente e as chaves de colunas mapeadas para a exportação personalizada em Excel.

### 1. Variáveis de Ambiente e Chaves de Integração
As seguintes chaves e configurações devem estar presentes para o correto funcionamento das integrações em nuvem e APIs:

| Chave / Propriedade | Origem | Descrição | Relevância |
| :--- | :--- | :--- | :--- |
| **`GEMINI_API_KEY`** | `.env` | Chave de API do Google Gemini. Injetada automaticamente pelo AI Studio a partir dos segredos. | OCR e leitura autônoma de etiquetas de carga e trackings por IA. |
| **`APP_URL`** | `.env` | URL pública onde a aplicação está hospedada. Injetada no Cloud Run. | Links autorreferenciais e tratamento de callbacks/redirecionamentos. |
| **`projectId`** | `firebase-applet-config.json` | ID único do projeto Firebase provisionado. | Isolamento e identificação do banco de dados na GCP. |
| **`apiKey`** | `firebase-applet-config.json` | Chave pública de API do Firebase Client. | Autenticação social de usuários e sincronização direta segura. |
| **`firestoreDatabaseId`** | `firebase-applet-config.json` | Identificador do banco de dados Firestore específico do Tenant. | Conexão estrita e autoritativa com a fonte da verdade de dados logísticos. |
| **`storageBucket`** | `firebase-applet-config.json` | Endpoint do bucket de Cloud Storage. | Destino de armazenamento definitivo de imagens de carga e arquivos frios gzip. |

---

### 2. Chaves de Colunas para Exportação em Excel
As colunas abaixo representam os identificadores exclusivos (**IDs**) e rótulos exibidos no painel **"3. Seleção de Colunas a Exportar"** dentro do modal de exportação. O operador do sistema pode marcar ou desmarcar cada uma dessas chaves para personalizar o arquivo de saída gerado.

#### 📌 Grupo: Geral
*   **`number`** (*Número do WR*): Código identificador único do Warehouse Receipt.
*   **`createdAt`** (*Data de Cadastro*): Timestamp de criação do registro no banco.
*   **`dateIn`** (*Data de Entrada*): Data operacional de recepção informada pelo pátio.
*   **`status`** (*Status da Carga*): Estado atual da carga (ex: `RECEBIDO`, `DESPACHADO`).

#### 📌 Grupo: Logística
*   **`shipperName`** (*Shipper Name*): Nome do exportador original da mercadoria.
*   **`consigneeName`** (*Consignee Name*): Nome do destinatário final da carga.
*   **`blNumber`** (*Número do BL (Consolidação)*): Código do Bill of Lading correspondente, caso consolidado.
*   **`trackingNumber`** (*Código de Rastreio / Pro*): Tracking number de rastreamento extraído ou preenchido.
*   **`location`** (*Localização no Armazém*): Corredor / BIN / Setor físico onde o volume se encontra.
*   **`via`** (*Via de Transporte*): Canal logístico utilizado (ex: `Aéreo`, `Marítimo`, `Terrestre`).

#### 📌 Grupo: Dimensões & Peso (Totais da Carga)
*   **`totalPieces`** (*Total de Volumes*): Quantidade agregada de volumes no Warehouse Receipt.
*   **`totalWeightLbs`** (*Peso Total (Lbs)*): Peso somado em Libras (utilizado na unidade US).
*   **`totalWeightKgs`** (*Peso Total (Kgs)*): Peso somado em Quilogramas (utilizado na unidade Europeia).
*   **`totalCubicCft`** (*Volume Total (Cft)*): Cubicagem calculada agregada em Pés Cúbicos.
*   **`totalCubicCbm`** (*Volume Total (Cbm)*): Cubicagem calculada agregada em Metros Cúbicos.

#### 📌 Grupo: Itens Detalhados (LxWxH por Peça)
*Esta seção é utilizada no **Modo Detalhado** de exportação para desmembrar o recibo linha por linha para cada volume:*
*   **`itemQty`** (*Qtd do Item*): Quantidade de peças idênticas desse item específico.
*   **`itemType`** (*Tipo do Item*): Tipo do volume físico (ex: `BOX`, `PALLET`, `CRATE`, `DRUM`).
*   **`itemDims`** (*Dimensões do Item LxWxH*): **As dimensões físicas completas no formato Comprimento x Largura x Altura (LxWxH)**, convertendo-se dinamicamente conforme a unidade de medida atual.
*   **`itemWeight`** (*Peso do Item*): Peso individual do item com respectiva unidade de medida.
*   **`itemCubic`** (*Volume do Item*): Volume cúbico individual calculado para o item.
*   **`itemCondition`** (*Condição do Item*): Estado de conservação ou anomalias registradas no recebimento.

#### 📌 Grupo: Comentários & Detalhes
*   **`comments`** (*Comentários*): Observações logísticas adicionais inseridas na triagem.
*   **`operatorEmail`** (*Email do Operador*): Registro histórico de auditoria do usuário logado que cadastrou o WR.

---

## ⚙️ Como Executar o Projeto Localmente

1.  **Instalação de Dependências**:
    ```bash
    npm install
    ```
2.  **Configuração do Ambiente**:
    Duplique o arquivo `.env.example` para `.env` e preencha as variáveis secretas, principalmente a `GEMINI_API_KEY` para o funcionamento do OCR de fotos por Inteligência Artificial.
3.  **Execução em Modo de Desenvolvimento**:
    ```bash
    npm run dev
    ```
4.  **Compilação para Produção**:
    ```bash
    npm run build
    ```
5.  **Inicialização de Produção**:
    ```bash
    npm run start
    ```

---

## 📊 Script de Verificação de Esquema e Integridade do Banco

Visando mitigar regressões e garantir que todas as informações necessárias para a renderização correta da interface permaneçam consistentes a cada atualização ou implementação na plataforma, incluímos um **script autônomo de diagnóstico e auditoria de esquema**.

### 🛠️ Como Executar o Script
O script valida as coleções e regras do banco de dados no arquivo físico de cache local (`data/db.json`), garantindo integridade referencial antes do deploy. Para executar, utilize o comando:
```bash
node scripts/verify_db_schema.js
```

### 📋 Detalhamento das Coleções e Chaves do Banco de Dados

O banco de dados opera sob o seguinte contrato estrito de dados, que é verificado de forma síncrona pelo script:

#### 1. `tenants` (Empresas Clientes)
*   **`tenantId`** (`string` - Obrigatório): Identificador universal único do cliente corporativo.
*   **`name`** (`string` - Obrigatório): Nome fantasia / Razão social da empresa.
*   **`domain`** (`string` - Obrigatório): Domínio de e-mail corporativo associado ao tenant (ex: `qualitylogistics.com`).
*   **`planTier`** (`string` - Obrigatório): Plano de faturamento (`Starter`, `Pro` ou `Enterprise`).
*   **`status`** (`string` - Obrigatório): Estado da empresa (`active` ou `suspended`).
*   **`retentionDays`** (`number` - Opcional): Janela de retenção em dias para soft-delete e purga automática do tenant (campo canônico, padrão 30).

#### 2. `users` (Controle de Usuários)
*   **`uid`** (`string` - Obrigatório): ID único do usuário autenticado (UID do Firebase Auth / Google Auth).
*   **`email`** (`string` - Obrigatório): Endereço de e-mail do usuário.
*   **`name`** (`string` - Obrigatório): Nome completo do colaborador.
*   **`tenantId`** (`string` - Obrigatório): ID da empresa à qual o usuário pertence.
*   **`tenantRole`** (`string` - Obrigatório): Papel no nível do tenant (`owner`, `admin`, ou `operator`).
*   **`platformRole`** (`string` - Obrigatório): Papel no nível de plataforma (`superadmin` ou `user`).
*   **`assignedUnitId`** (`string` - Opcional): Unidade/Filial padrão associada ao operador/gerente.

#### 3. `shippers` (Exportadores)
*   **`id`** (`string` - Obrigatório): ID único do exportador.
*   **`name`** (`string` - Obrigatório): Nome da empresa exportadora.
*   **`tenantId`** (`string` - Obrigatório): ID da empresa vinculada.
*   **`createdAt`** (`string` - Obrigatório): Carimbo de data de cadastro em formato ISO 8601 UTC.

#### 4. `consignees` (Destinatários)
*   **`id`** (`string` - Obrigatório): ID único do destinatário.
*   **`name`** (`string` - Obrigatório): Nome da empresa destinatária.
*   **`tenantId`** (`string` - Obrigatório): ID da empresa vinculada.
*   **`createdAt`** (`string` - Obrigatório): Carimbo de data de cadastro em formato ISO 8601 UTC.

#### 5. `receipts` (Warehouse Receipts - WR)
*   **`id`** (`string` - Obrigatório): ID único do recibo.
*   **`number`** (`string` - Obrigatório): Código legível do WR (ex: `WR-11986`).
*   **`shipperId`** (`string` - Obrigatório): Referência ao Shipper cadastrado.
*   **`shipperName`** (`string` - Obrigatório): Nome do Shipper para renderização rápida.
*   **`consigneeId`** (`string` - Obrigatório): Referência ao Consignee cadastrado.
*   **`consigneeName`** (`string` - Obrigatório): Nome do Consignee para renderização rápida.
*   **`totalPieces`** (`number` - Obrigatório): Contagem de volumes.
*   **`totalWeightLbs`** / **`totalWeightKgs`** (`number` - Obrigatório): Peso aferido total.
*   **`totalCubicCft`** / **`totalCubicCbm`** (`number` - Obrigatório): Cubagem calculada total.
*   **`photoUrl`** (`string` - Obrigatório): Link direto da imagem/anexo da etiqueta ou carga (ou `"CLEANED_UP"` para itens expurgados).
*   **`status`** (`string` - Obrigatório): Status operacional (`RECEBIDO`, `DESPACHADO` ou `RECICLADO`).
*   **`tenantId`** (`string` - Obrigatório): ID do tenant proprietário da carga.
*   **`unitId`** (`string` - Opcional): Vinculação da filial de entrada/recebimento.
*   **`deletedAt`** (`string` | `null` - Opcional): Timestamp ISO 8601 UTC para controle de soft-delete/lixeira.
*   **`deletedBy`** (`string` | `null` - Opcional): E-mail do executor da exclusão.
*   **`createdAt`** (`string` - Obrigatório): Carimbo de data de cadastro em formato ISO 8601 UTC.

#### 6. `billsOfLading` (Conhecimento de Embarque - BL)
*   **`id`** (`string` - Obrigatório): ID único do despacho.
*   **`blNumber`** (`string` - Obrigatório): Código do Bill of Lading (ex: `QL2848`).
*   **`documentNumber`** (`string` - Obrigatório): Número oficial do manifesto.
*   **`exporter`** / **`consignee`** (`string` - Obrigatório): Blocos de textos estruturados de endereços físicos para emissão do PDF oficial.
*   **`receiptIds`** (`array` - Obrigatório): Lista contendo os IDs dos Warehouse Receipts vinculados.
*   **`receiptNumbers`** (`array` - Obrigatório): Lista contendo os códigos legíveis dos WRs (ex: `["WR-11986", "WR-10002"]`).
*   **`tenantId`** (`string` - Obrigatório): ID do tenant de origem.
*   **`originUnitId`** (`string` - Opcional): Unidade de origem da consolidação do embarque.
*   **`deletedAt`** (`string` | `null` - Opcional): Timestamp ISO 8601 UTC para controle de soft-delete/lixeira.
*   **`deletedBy`** (`string` | `null` - Opcional): E-mail do executor da exclusão.
*   **`createdAt`** (`string` - Obrigatório): Carimbo de data de cadastro em formato ISO 8601 UTC.

#### 7. `invitations` (Convites do Sistema SaaS)
*   **`id`** (`string` - Obrigatório): Token alfanumérico do convite.
*   **`email`** (`string` - Obrigatório): E-mail do usuário convidado.
*   **`tenantId`** (`string` - Obrigatório): ID da empresa que está convidando.
*   **`tenantRole`** (`string` - Obrigatório): Papel pré-determinado (`owner`, `admin` ou `operator`) (campo canônico).
*   **`status`** (`string` - Obrigatório): Status do onboarding (`pending` ou `accepted`).
*   **`createdAt`** (`string` - Obrigatório): Carimbo de data de geração do convite.

#### 8. `units` (Filiais / Configurações de Unidades)
*   **`id`** (`string` - Obrigatório): ID único da filial/planta.
*   **`tenantId`** (`string` - Obrigatório): ID do tenant associado.
*   **`name`** (`string` - Obrigatório): Nome da filial ou pátio (ex: `Armazém Miami-FL`).
*   **`unitSystem`** (`string` - Obrigatório): Sistema de medidas adotado por padrão (`imperial` ou `metric`).
*   **`createdAt`** (`string` - Obrigatório): Timestamp de criação.
*   **`isActive`** (`boolean` - Obrigatório): Flag indicativa se a filial está ativa na interface.

#### 9. `auditLog` (Logs Imutáveis)
*   **`id`** (`string` - Obrigatório): ID único do log de auditoria.
*   **`action`** (`string` - Obrigatório): Ação disparada (ex: `LOGIN`, `SOFT_DELETE`, `RESTORE`, `PURGE`).
*   **`resource`** (`string` - Obrigatório): Tipo do recurso afetado (ex: `auth`, `receipts`, `shippers`).
*   **`resourceId`** (`string` - Obrigatório): ID do registro modificado ou acessado.
*   **`tenantId`** (`string` - Obrigatório): ID do tenant correspondente.
*   **`performedBy`** (`string` - Obrigatório): E-mail do usuário autor da ação.
*   **`performedByUid`** (`string` - Opcional): UID imutável do usuário autor para auditoria resiliente.
*   **`timestamp`** (`string` - Obrigatório): Carimbo UTC exato do evento.
