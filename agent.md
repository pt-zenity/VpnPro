Ты senior full-stack architect, DevOps engineer и backend engineer. Спроектируй и начни реализацию self-hosted admin panel для управления OpenVPN XOR нодами.

Контекст:
У меня уже есть рабочий bash-инсталлятор OpenVPN XOR для Ubuntu 22.04/24.04. Он:
- собирает OpenVPN 2.7.3 с XOR patch
- генерирует XOR mask
- настраивает server.conf
- инициализирует EasyRSA PKI
- выпускает server/client certs
- создаёт tls-crypt key
- настраивает iptables/NAT
- создаёт systemd service openvpn-xor
- создаёт config.env
- создаёт admin scripts:
  - add-user.sh
  - revoke-user.sh
  - list-users.sh
  - status.sh
  - backup.sh
  - export-ovpn
- генерирует клиентские .ovpn
- экспортирует клиентские конфиги

Цель:
Мне нужна простая админка, не биллинг, не клиентский кабинет, а именно control panel, где:
1. Я подключаю сервер как node.
2. Я могу установить OpenVPN XOR на node или привязать уже готовую ноду.
3. Я вижу список node серверов и их состояние.
4. Я создаю из админки клиентские конфиги OpenVPN для конкретной ноды.
5. Я могу revoke клиента.
6. Я могу скачать готовый .ovpn.
7. Архитектура должна быть MVP-first, но с возможностью масштабирования на много нод.

Главный сценарий:
- добавить node
- проверить соединение
- установить OpenVPN XOR
- синхронизировать состояние
- создать client config
- скачать .ovpn
- revoke client

Ограничения:
- Не переписывай OpenVPN-логику заново.
- Нужно переиспользовать существующий bash/admin layer.
- Операции на ноде требуют root-level действий, systemd, iptables, EasyRSA.
- Нужна безопасная архитектура.
- Подход должен быть self-hosted friendly.
- UI минималистичный, тёмный, как modern infra dashboard.
- Код должен быть practical, не theoretical.

Предпочтительная архитектура:
- central panel
- PostgreSQL
- Redis + BullMQ
- Prisma
- Next.js + TypeScript + Tailwind
- node agent на каждой VPN ноде
- panel <-> agent communication
- audit logs
- RBAC
- async jobs

Что нужно сделать по шагам:

Шаг 1. Предложи architecture overview:
- components
- data flow
- panel responsibilities
- agent responsibilities
- background jobs
- sync model
- download flow for .ovpn
- why agent is better than direct SSH

Шаг 2. Предложи precise domain model:
- Admin
- Node
- NodeAuth
- VpnClient
- ClientArtifact
- Job
- HealthCheck
- AuditLog

Шаг 3. Опиши database schema и связи.

Шаг 4. Сгенерируй Prisma schema для MVP.

Шаг 5. Опиши REST API contracts:
Panel API:
- auth
- nodes CRUD
- install node
- sync node
- list clients
- create client
- revoke client
- download config
- jobs
- audit logs

Agent API:
- heartbeat
- install
- sync
- create client
- revoke client
- list clients
- get config
- status

Для каждого endpoint дай:
- method
- path
- request body
- response body
- error cases

Шаг 6. Опиши security model:
- node registration
- token issuance
- token rotation
- secret encryption
- access control
- audit logging
- restricting agent commands
- preventing arbitrary command execution

Шаг 7. Опиши node lifecycle:
- add node
- verify node
- bootstrap node
- install OpenVPN XOR
- check service state
- create client
- revoke client
- resync after drift
- recover failed install

Шаг 8. Опиши как адаптировать существующие bash scripts под agent:
- перевести install script в non-interactive mode
- добавить JSON output
- стандартизировать exit codes
- разделить install, status, create-client, revoke-client, export-client
- сделать whitelist command executor

Шаг 9. Предложи monorepo structure.

Шаг 10. Опиши UI pages:
- login
- dashboard
- nodes list
- node details
- clients table
- create client modal
- jobs page
- audit page

Шаг 11. Составь MVP roadmap в 4 phase.

Шаг 12. Сгенерируй starter code:
- prisma schema
- docker compose
- env example
- basic Next.js app shell
- nodes API routes
- agent heartbeat endpoint
- create-client job contract
- Zod validators
- shared TypeScript types

Шаг 13. В конце задай 7 критичных вопросов, которые реально влияют на архитектуру.

Требования к ответу:
- Пиши структурированно.
- Не давай воды.
- Давай конкретные таблицы, схемы, payload примеры, код и контракты.
- Используй strict TypeScript.
- Используй production-minded patterns.
- Сразу ориентируйся на реальную разработку.
