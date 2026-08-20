@echo off
REM Video Copy App - Windows 启动脚本
REM 用法: start.bat [dev|prod|test|stop|clean|help]

setlocal enabledelayedexpansion

set MODE=%1
if "%MODE%"=="" set MODE=dev

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

REM 终端颜色 (Windows 10+)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "NC=[0m"

goto main

:log_info
    echo %GREEN%[INFO]%NC% %~1
    exit /b

:log_warn
    echo %YELLOW%[WARN]%NC% %~1
    exit /b

:log_error
    echo %RED%[ERROR]%NC% %~1
    exit /b

:check_env
    call :log_info "开始环境检查..."

    REM 检查 Node.js
    where node >nul 2>&1
    if errorlevel 1 (
        call :log_error "未检测到 Node.js，请先安装 Node.js 18+"
        exit /b 1
    )

    for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a
    set NODE_MAJOR=%NODE_MAJOR:v=%
    if %NODE_MAJOR% LSS 18 (
        call :log_error "Node.js 版本过低，需要 18 及以上"
        exit /b 1
    )
    call :log_info "Node.js 版本检查通过"

    REM 检查 .env.local 是否存在
    if not exist ".env.local" (
        call :log_warn ".env.local 不存在，将从 .env.example 复制..."
        copy .env.example .env.local >nul
        call :log_warn "请编辑 .env.local 填入 GLM_API_KEY"
        call :log_warn "获取地址: https://open.bigmodel.cn/"
        exit /b 1
    )

    REM 检查 GLM_API_KEY
    findstr /C:"GLM_API_KEY=" .env.local | findstr /V /C:"your-glm-api-key" >nul
    if errorlevel 1 (
        call :log_error "请在 .env.local 中配置有效的 GLM_API_KEY"
        exit /b 1
    )
    call :log_info "GLM_API_KEY 配置正确"

    REM 检查 Redis (可选)
    where redis-cli >nul 2>&1
    if not errorlevel 1 (
        redis-cli ping >nul 2>&1
        if not errorlevel 1 (
            call :log_info "Redis 连接正常"
        ) else (
            call :log_error "Redis 未运行"
            call :log_info "启动 Redis: docker run -d --name redis -p 6379:6379 redis:alpine"
            exit /b 1
        )
    ) else (
        call :log_warn "未找到 redis-cli，请确认 Redis 已启动"
    )

    REM 检查依赖
    if not exist "node_modules" (
        call :log_info "正在安装依赖..."
        call npm install
    )

    call :log_info "环境检查通过"
    exit /b 0

:start_dev
    call :log_info "正在启动开发模式..."

    REM 启动 Worker
    call :log_info "正在启动 Worker..."
    start /B cmd /c "npm run worker > worker.log 2>&1"
    timeout /t 2 /nobreak >nul

    REM 启动 Web 服务
    call :log_info "正在启动 Web 服务..."
    call :log_info "访问地址: http://localhost:3000"
    call npm run dev
    exit /b

:start_prod
    call :log_info "正在启动生产模式..."

    REM 构建
    if not exist ".next" (
        call :log_info "正在构建..."
        call npm run build
    )

    REM 启动 Worker
    call :log_info "正在启动 Worker..."
    start /B cmd /c "npm run worker > worker.log 2>&1"
    timeout /t 2 /nobreak >nul

    REM 启动服务
    call :log_info "正在启动服务..."
    call :log_info "访问地址: http://localhost:3000"
    call npm start
    exit /b

:start_test
    call :log_info "正在运行单元测试..."

    REM 运行测试
    call :log_info "正在运行单元测试..."
    call npm test

    REM E2E 测试
    call :log_info "是否运行 E2E 测试？"
    set /p REPLY="是否运行 E2E 测试？ (y/N): "
    if /i "%REPLY%"=="y" (
        call npm run test:e2e
    )
    exit /b

:stop_services
    call :log_info "停止服务..."

    REM 只停止本应用的 Node.js 进程（通过端口3000）
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
        if not errorlevel 1 (
            call :log_info "已停止 Web 服务 (端口3000)"
        )
    )

    REM 停止 Worker 进程（通过命令行特征匹配）
    for /f "tokens=2" %%a in ('wmic process where "commandline like '%%npm run worker%%' or commandline like '%%tsx scripts/worker.ts%%'" get processid 2^>nul ^| findstr /r "[0-9]"') do (
        taskkill /F /PID %%a >nul 2>&1
        if not errorlevel 1 (
            call :log_info "已停止 Worker 进程"
        )
    )

    REM 清理日志文件
    if exist "worker.log" del worker.log

    call :log_info "所有服务已停止"
    exit /b

:clean_data
    call :log_warn "此操作将删除所有任务数据..."
    set /p REPLY="确认删除所有任务数据？ (y/N): "
    if /i "%REPLY%"=="y" (
        if exist "video-app.db" del video-app.db
        if exist ".storage" rd /s /q .storage
        mkdir .storage
        call :log_info "数据已清理"
    )
    exit /b

:show_help
    echo Video Copy App - Windows 启动脚本
    echo.
    echo 用法:
    echo   start.bat [参数]
    echo.
    echo 参数:
    echo   dev       启动开发模式(默认)
    echo   prod      启动生产模式
    echo   test      运行单元测试
    echo   stop      停止所有服务
    echo   clean     清理任务数据
    echo   help      显示帮助
    echo.
    echo 示例:
    echo   start.bat dev      # 开发模式
    echo   start.bat prod     # 生产模式
    echo   start.bat test     # 单元测试
    echo   start.bat stop     # 停止服务
    echo   start.bat clean    # 清理数据
    echo.
    echo 首次使用:
    echo   1. start.bat       # 自动生成 .env.local
    echo   2. 编辑 .env.local 填入 GLM_API_KEY
    echo   3. 启动 Redis
    echo   4. start.bat dev   # 启动应用
    echo.
    exit /b

:main
    if "%MODE%"=="dev" (
        call :check_env
        if errorlevel 1 exit /b 1
        call :start_dev
    ) else if "%MODE%"=="prod" (
        call :check_env
        if errorlevel 1 exit /b 1
        call :start_prod
    ) else if "%MODE%"=="test" (
        call :check_env
        if errorlevel 1 exit /b 1
        call :start_test
    ) else if "%MODE%"=="stop" (
        call :stop_services
    ) else if "%MODE%"=="clean" (
        call :clean_data
    ) else if "%MODE%"=="help" (
        call :show_help
    ) else (
        call :log_error "未知参数: %MODE%"
        call :show_help
        exit /b 1
    )

    exit /b 0
