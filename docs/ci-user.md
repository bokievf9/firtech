# CI-пользователь `firtech-ci` (security 2026-11-23, P1-5)

Было: ключ GitHub Actions входит как `deploy`, а у `deploy` `NOPASSWD sudo` и группа `docker`
(`~/fir-tech/docs/server-init-2026-11.sh`). Кто украл ключ из CI, тот root на сервере, где живут все проекты.

Стало (как в agents: `command="…",restrict`): отдельный пользователь `firtech-ci` без sudo, без docker и без
shell. Его ключ может только одно: запустить `/usr/local/bin/firtech-receive.sh` (копия
`scripts/deploy/receive.sh`), который принимает ОДИН tar.gz релиза на stdin (до 400 МБ, имя релиза
проверяется регуляркой) и кладёт его в `/var/www/firtech/incoming`. Распаковку и включение делает `deploy`
через systemd (`firtech-deploy.path` -> `firtech-deploy.service` -> `/usr/local/bin/firtech-activate-incoming.sh`,
копия `scripts/deploy/activate-incoming.sh`): проверяет, что в архиве нет ссылок, `..` и путей вне `<id>/`,
распаковывает и запускает серверную копию `activate.sh` (`/usr/local/bin/firtech-activate.sh`), а не ту, что
пришла в архиве. `receive.sh` ждёт результата (до 300 с) и печатает лог, поэтому CI по-прежнему падает, если
релиз не поднялся. Экшены в `.github/workflows/*.yml` закреплены по SHA (`tests/ci.test.mjs`).

Все скрипты на сервере принадлежат root (`755`), `authorized_keys` тоже root (`644`): ни CI, ни процесс от
`firtech-ci` не может расширить свои права.

## 1. Mac: ключ для CI (владелец, с префиксом `!`)

```bash
ssh-keygen -t ed25519 -N '' -C github-actions-firtech-ci -f ~/.ssh/firtech_ci
cat ~/.ssh/firtech_ci.pub
```

## 2. Mac: скрипты на сервер (из папки `~/fir-tech/firtech` после слияния ветки)

```bash
scp -i ~/.ssh/id_ed25519_firtech scripts/deploy/receive.sh scripts/deploy/activate-incoming.sh scripts/deploy/activate.sh scripts/deploy/ci-user-setup.sh deploy@201.79.122.133:/tmp/
```

## 3. Сервер: пользователь, права, systemd (одна команда с Mac)

Скрипт `scripts/deploy/ci-user-setup.sh` (идемпотентный) делает всё сразу: пользователь без пароля, sudo и
docker; root-owned копии скриптов; папки обмена `incoming`, `incoming/ready`, `ci-status` (владелец `deploy`,
группа `firtech-ci`, `2770`); `authorized_keys` с `command="/usr/local/bin/firtech-receive.sh",restrict`;
юниты `firtech-deploy.service` (User=deploy, `KillMode=process`) и `firtech-deploy.path`. Подставьте строку
из `~/.ssh/firtech_ci.pub` целиком:

```bash
ssh -i ~/.ssh/id_ed25519_firtech deploy@201.79.122.133 "sudo bash /tmp/ci-user-setup.sh 'ssh-ed25519 AAAA... github-actions-firtech-ci'"
```

## 4. Проверка с Mac

```bash
ssh -i ~/.ssh/firtech_ci -o IdentitiesOnly=yes firtech-ci@201.79.122.133 whoami
# ожидается: refused: expected a release id like 20261123101500-abcdef0
```

## 5. GitHub (главное окно, после подтверждения владельца, по одной команде)

```bash
gh secret set VPS_USER -R bokievf9/firtech --env production --body firtech-ci
gh secret set VPS_SSH_KEY -R bokievf9/firtech --env production < ~/.ssh/firtech_ci
gh variable set DEPLOY_RECEIVE -R bokievf9/firtech --body 1
```

Следующий push в `main` идёт новым путём (шаг «Upload and activate (restricted CI user)»). Откат:
`gh variable set DEPLOY_RECEIVE -R bokievf9/firtech --body 0` и старые `VPS_USER`/`VPS_SSH_KEY`.
Пока `DEPLOY_RECEIVE` не `1`, работает старый путь (как `deploy`).

## 6. После первого успешного деплоя: убрать старый CI-ключ у `deploy`

```bash
ssh -i ~/.ssh/id_ed25519_firtech deploy@201.79.122.133 'cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak-2026-11-23 && grep -v "github-actions-firtech$" ~/.ssh/authorized_keys.bak-2026-11-23 > ~/.ssh/authorized_keys && cut -c1-30,80- ~/.ssh/authorized_keys'
```

Проверьте, что ключ владельца `firtech-deploy` остался в выводе.

## Остаточный риск

Код релиза по-прежнему исполняет `deploy` (PM2), а у `deploy` `NOPASSWD sudo` и `docker`: вредоносный релиз из
взломанного CI всё ещё может стать root. Новый путь закрывает прямой вход по CI-ключу и произвольные команды, но
не это. Следующий шаг (решение владельца): запускать сайт под отдельным пользователем без sudo/docker или снять
`NOPASSWD` у `deploy` (`/etc/sudoers.d/deploy`, sudo по паролю).
