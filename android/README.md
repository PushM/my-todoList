# Android App

这个目录是项目的 Android 客户端，用 `WebView` 复用现有手机网页界面，并把已完成任务同步到手机系统日历。

## 功能

- 复用现有手机网页端的四象限待办界面
- 继续使用服务端 `/api/sync` 做多端数据同步
- 安卓端把已完成任务写入系统日历
- 本机完成任务时，立即触发一次日历同步
- 其他设备完成任务时，通过 `WorkManager` 周期拉取并同步到日历

## 重要限制

- 安卓端必须填写 `服务器地址`
- 后台自动同步依赖 `WorkManager`，首版不是秒级推送
- 首次使用要授予日历权限
- 设备里必须先有一个可写入的系统日历账户，否则只能同步待办，不能写入日历

## 开发运行

1. 用 Android Studio 打开 [android](/D:/project/my-todoList/android)
2. 等待 Gradle 同步完成
3. 连接真机或启动模拟器
4. 运行 `app` 模块

## 正式安装

推荐安装 `release` 包，而不是 `debug` 包。

当前正式包构建命令：

```powershell
cd D:\project\my-todoList\android
D:\mytools\gradle-9.5.0-all\gradle-9.5.0\bin\gradle.bat assembleRelease
```

构建产物默认在：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 签名文件

本项目支持本地 `release` 签名，签名文件不会提交到 Git。

本地签名目录：

```text
android/signing/
```

其中：

- `release-keystore.jks` 是签名证书
- `release.properties` 是本地签名配置
- `release.properties.example` 是示例模板

后续如果你换自己的证书，按示例文件填写即可。

## 真机使用步骤

1. 启动服务端：`npm run start:server`
2. 把 `app-release.apk` 发到手机
3. 在手机里安装 APK
4. 打开 App，填写服务器地址，例如 `http://115.190.201.253:8787`
5. 填写同步码
6. 授予日历权限
7. 选择一个系统日历作为写入目标

## 日历账户要求

如果提示“当前设备没有可写入的日历”，说明系统里还没有日历账户。

常见解决方式：

- 小米账号并开启日历同步
- Google 账号并开启日历同步
- Exchange / 企业邮箱日历账户

## 同步逻辑

- 安卓端本机完成任务：立即更新系统日历
- 其他设备完成任务：后台 worker 拉取服务端状态，再同步到系统日历
- 撤销完成或删除任务：安卓端删除对应日历事件
- 改完成日期：安卓端更新对应日历事件日期
