# My TodoList

一个支持桌面端、网页端、手机端和 Android 日历同步的待办工具。

## 功能

- 进行中的任务按四象限展示
- 四象限之间支持拖动，同象限内支持排序
- 完成任务时可直接选择日期写入日历记录
- 已完成任务在日历日期详情里管理，不单独占用列表
- 支持桌面端、便签窗口、网页端、手机端共享同一份待办数据
- 提供 Android 客户端，把完成任务同步到手机系统日历

## 项目结构

- `src/`：Electron 桌面端
- `server/`：同步服务和网页端
- `android/`：Android 客户端

## 安装依赖

```powershell
cd D:\project\my-todoList
npm install
```

## 运行方式

桌面端：

```powershell
cd D:\project\my-todoList
npm start
```

同步服务：

```powershell
cd D:\project\my-todoList
npm run start:server
```

推荐开两个终端：

1. 一个终端运行 `npm run start:server`
2. 另一个终端运行 `npm start`

## 网页端地址

电脑浏览器网页端：

```text
http://127.0.0.1:8787/
```

手机网页端：

```text
http://127.0.0.1:8787/mobile/
```

如果是局域网访问，把 `127.0.0.1` 换成电脑局域网 IP，例如：

```text
http://192.168.1.10:8787/
http://192.168.1.10:8787/mobile/
```

## 同步说明

所有端要填写同一个同步码，才会共享同一份待办和日历数据。

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

服务端数据保存在：

```text
server/data/
```

这个目录已被 `.gitignore` 忽略，里面包含同步数据和备份。更新服务端代码时不要删除它。

重点保留：

```text
server/data/sync-store.json
server/data/backups/
```

## Android 安装

Android 客户端说明见：

[android/README.md](/D:/project/my-todoList/android/README.md)

如果你要自己长期安装和覆盖升级，推荐使用 `release` 包：

```powershell
cd D:\project\my-todoList\android
D:\mytools\gradle-9.5.0-all\gradle-9.5.0\bin\gradle.bat assembleRelease
```

构建产物：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 生产部署（域名 + HTTPS）

### 前提

- 域名已购买并解析到服务器公网 IP
- ECS 安全组已放行 80 和 443 端口
- 已在火山引擎证书中心申请并签发 SSL 证书（免费 DV 单域名）

### 服务器一次性配置

```bash
# 1. 安装 Nginx
sudo apt update && sudo apt install nginx -y

# 2. 克隆代码
git clone https://github.com/PushM/my-todoList.git /opt/todo-server
cd /opt/todo-server
npm install

# 3. 上传证书文件到服务器
# 从火山引擎证书中心下载证书（Nginx 格式），得到 .crt 和 .key 文件
# 将证书上传至服务器：
sudo mkdir -p /etc/nginx/ssl
# 把 certificate.crt 和 private.key 上传到 /etc/nginx/ssl/
# 合并证书链（下载包里通常有 ca_bundle.crt）：
sudo cat /etc/nginx/ssl/certificate.crt /etc/nginx/ssl/ca_bundle.crt > /etc/nginx/ssl/todoquad.cn.pem
sudo mv /etc/nginx/ssl/private.key /etc/nginx/ssl/todoquad.cn.key
sudo chmod 600 /etc/nginx/ssl/todoquad.cn.key

# 4. 启用 Nginx 配置
sudo ln -s /opt/todo-server/server/nginx.conf /etc/nginx/sites-enabled/todo.conf
sudo nginx -t && sudo systemctl reload nginx

# 5. 安装 systemd 服务
sudo cp /opt/todo-server/server/todo-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now todo-server
```

### 证书续期

火山引擎免费 DV 证书有效期一年，到期前在控制台重新申请，下载新证书覆盖 `/etc/nginx/ssl/` 下的文件后 `sudo systemctl reload nginx`。

### 日常更新

```bash
# 服务器上
cd /opt/todo-server
git pull
npm install        # 依赖有变化时
sudo systemctl restart todo-server
```

### 注意

更新代码时**不要**覆盖或删除 `server/data/` 目录。

## GitHub

仓库地址：

[https://github.com/PushM/my-todoList.git](https://github.com/PushM/my-todoList.git)
