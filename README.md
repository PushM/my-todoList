# My TodoList

一个 Electron 桌面待办 + 桌面便签 + 网页端待办应用，支持完成记录日历、多端同步和四象限任务管理。

## 功能

- 进行中任务按时间管理四象限展示：既紧急又重要、重要不紧急、紧急不重要、不紧急不重要。
- 四象限之间支持拖拽移动，象限内也支持拖拽排序。
- 完成任务时选择日期，任务会写入完成日历。
- 已完成任务不单独占用列表，只在日历中点击某一天后查看和管理。
- 日历当天任务支持撤销、改日期、删除。
- 支持桌面端、桌面便签窗口、网页端/手机端同步同一份数据。

## 运行

安装依赖：

```powershell
npm install
```

启动桌面端：

```powershell
npm start
```

启动同步服务：

```powershell
npm run start:server
```

网页端入口：

```text
http://127.0.0.1:8787/mobile/
```

局域网手机访问时，把 `127.0.0.1` 换成电脑的局域网 IP，例如：

```text
http://192.168.1.10:8787/mobile/
```

## 同步说明

桌面端和网页端需要填写同一个同步码，才能共享同一份待办和日历数据。

同步服务默认监听：

```text
http://0.0.0.0:8787
```

可通过环境变量修改：

```powershell
$env:HOST="0.0.0.0"
$env:PORT="8787"
npm run start:server
```

## 数据目录

同步服务数据保存在：

```text
server/data/
```

这个目录已被 `.gitignore` 忽略，里面包含同步数据和备份，部署或更新服务端代码时不要删除它。

重点保留：

```text
server/data/sync-store.json
server/data/backups/
```

## 部署更新

如果服务器上已经有运行中的数据，只更新代码即可：

```powershell
git pull
npm install
npm run start:server
```

如果是手工上传，只覆盖这些代码文件，不要覆盖或删除 `server/data/`：

```text
server/server.js
server/public/
src/
package.json
package-lock.json
```

## GitHub

仓库地址：

```text
https://github.com/PushM/my-todoList.git
```
