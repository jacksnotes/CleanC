const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { exec, spawn } = require('child_process')

const isDev = !app.isPackaged
let mainWindow, tray = null

// 恢复区配置 - 使用 C 盘用户数据目录，确保同盘移动速度快
const RECOVERY_ZONE = path.join(os.homedir(), 'AppData', 'Local', 'CleanC', 'RecoveryZone')

// 检查是否以管理员权限运行
function isAdmin() {
    try {
        // 尝试读取一个需要管理员权限的文件
        fs.accessSync('C:\\Windows\\System32\\config\\SAM', fs.constants.R_OK)
        return true
    } catch (e) {
        return false
    }
}

// 请求管理员权限重启
function requestAdminRestart() {
    if (isDev) {
        // 开发模式：打开管理员 PowerShell 运行开发服务器
        const projectPath = path.join(__dirname, '..')
        const psCommand = `Start-Process powershell -Verb RunAs -ArgumentList '-NoExit', '-Command', 'cd "${projectPath}"; npm run electron:dev'`

        exec(`powershell -Command "${psCommand}"`, (err) => {
            if (!err) {
                app.quit()
            }
        })
    } else {
        // 生产模式：直接提权 exe
        const exePath = process.execPath
        const logPath = path.join(path.dirname(exePath), 'cleanc_debug.log')

        try {
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] Requesting admin restart\n`)
            fs.appendFileSync(logPath, `EXE Path: ${exePath}\n`)

            // 使用 cmd /c start 作为跳板，这是在 Windows 上最可靠的完全分离进程的方法
            // 它可以彻底断开父子进程关系
            const cmdArgs = [
                '/c',
                'start',
                'powershell',
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-WindowStyle', 'Hidden',
                '-Command',
                `Start-Process -FilePath '${exePath}' -Verb RunAs`
            ]

            fs.appendFileSync(logPath, `Command: cmd ${cmdArgs.join(' ')}\n`)

            const child = spawn('cmd', cmdArgs, {
                detached: true,
                stdio: 'ignore', // 必须忽略 stdio 以确保完全分离
                windowsHide: true
            })

            child.unref()
            fs.appendFileSync(logPath, `Spawned child PID: ${child.pid}\n`)

        } catch (e) {
            try { fs.appendFileSync(logPath, `Error: ${e.message}\n`) } catch { }
        }

        // 延迟退出
        setTimeout(() => {
            app.quit()
        }, 1000)
    }
}

// 确保恢复区目录存在
function ensureRecoveryZone() {
    if (!fs.existsSync(RECOVERY_ZONE)) {
        try {
            fs.mkdirSync(RECOVERY_ZONE, { recursive: true })
            console.log('Recovery zone created:', RECOVERY_ZONE)
        } catch (e) {
            console.error('Failed to create recovery zone:', e.message)
        }
    }
}

// 环境变量展开
function expandEnvVars(pathStr) {
    if (!pathStr) return pathStr
    const envMap = {
        '%TEMP%': process.env.TEMP || path.join(os.homedir(), 'AppData', 'Local', 'Temp'),
        '%TMP%': process.env.TMP || process.env.TEMP,
        '%LOCALAPPDATA%': process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        '%APPDATA%': process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        '%USERPROFILE%': process.env.USERPROFILE || os.homedir()
    }
    let result = pathStr
    for (const [key, value] of Object.entries(envMap)) {
        result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), value)
    }
    return result.replace(/%([^%]+)%/g, (_, k) => process.env[k] || '')
}

// 精确计算目录大小 - 无深度限制
function getDirSizeExact(dirPath) {
    let size = 0
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name)
            try {
                if (entry.isFile()) {
                    size += fs.statSync(fullPath).size
                } else if (entry.isDirectory()) {
                    size += getDirSizeExact(fullPath) // 无深度限制递归
                }
            } catch (e) { }
        }
    } catch (e) { }
    return size
}

// 移动目录到恢复区
function moveToRecoveryZone(sourcePath, itemId) {
    ensureRecoveryZone()

    const timestamp = Date.now()
    const destDir = path.join(RECOVERY_ZONE, `${itemId}_${timestamp}`)

    // 保存元数据
    const metadata = {
        originalPath: sourcePath,
        movedAt: new Date().toISOString(),
        itemId: itemId
    }

    try {
        fs.mkdirSync(destDir, { recursive: true })

        // 复制文件到恢复区
        const entries = fs.readdirSync(sourcePath, { withFileTypes: true })
        let movedSize = 0
        let movedCount = 0

        for (const entry of entries) {
            const srcFile = path.join(sourcePath, entry.name)
            const destFile = path.join(destDir, entry.name)

            try {
                if (entry.isFile()) {
                    const stats = fs.statSync(srcFile)
                    fs.copyFileSync(srcFile, destFile)
                    fs.unlinkSync(srcFile) // 删除原文件
                    movedSize += stats.size
                    movedCount++
                } else if (entry.isDirectory()) {
                    // 递归移动目录
                    const subResult = moveDirectoryRecursive(srcFile, destFile)
                    movedSize += subResult.size
                    movedCount += subResult.count
                }
            } catch (e) {
                console.log(`  Skip: ${entry.name} (${e.message})`)
            }
        }

        // 保存元数据
        fs.writeFileSync(path.join(destDir, '_cleanc_metadata.json'), JSON.stringify(metadata, null, 2))

        console.log(`Moved ${movedCount} items (${(movedSize / 1e6).toFixed(1)} MB) to recovery zone`)
        return { success: true, movedSize, movedCount, recoveryPath: destDir }

    } catch (e) {
        console.error('Move to recovery failed:', e.message)
        return { success: false, error: e.message }
    }
}

// 递归移动目录
function moveDirectoryRecursive(src, dest) {
    let size = 0, count = 0

    try {
        fs.mkdirSync(dest, { recursive: true })
        const entries = fs.readdirSync(src, { withFileTypes: true })

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name)
            const destPath = path.join(dest, entry.name)

            try {
                if (entry.isFile()) {
                    const stats = fs.statSync(srcPath)
                    fs.copyFileSync(srcPath, destPath)
                    fs.unlinkSync(srcPath)
                    size += stats.size
                    count++
                } else if (entry.isDirectory()) {
                    const subResult = moveDirectoryRecursive(srcPath, destPath)
                    size += subResult.size
                    count += subResult.count
                }
            } catch (e) { }
        }

        // 尝试删除空目录
        try { fs.rmdirSync(src) } catch (e) { }

    } catch (e) { }

    return { size, count }
}

// 获取恢复区内容
function getRecoveryZoneItems() {
    ensureRecoveryZone()
    const items = []

    try {
        const entries = fs.readdirSync(RECOVERY_ZONE, { withFileTypes: true })

        for (const entry of entries) {
            const itemPath = path.join(RECOVERY_ZONE, entry.name)

            // 跳过 .meta.json 文件本身
            if (entry.name.endsWith('.meta.json')) continue

            // 新格式：检查同名 .meta.json 文件
            const newMetaPath = itemPath + '.meta.json'
            if (fs.existsSync(newMetaPath)) {
                try {
                    const metadata = JSON.parse(fs.readFileSync(newMetaPath, 'utf8'))
                    let size = 0
                    try {
                        const stats = fs.statSync(itemPath)
                        size = stats.isDirectory() ? getDirSizeExact(itemPath) : stats.size
                    } catch (e) { }

                    items.push({
                        id: entry.name,
                        originalPath: metadata.originalPath,
                        movedAt: metadata.movedAt,
                        size: size,
                        recoveryPath: itemPath,
                        isDirectory: metadata.isDirectory || entry.isDirectory()
                    })
                    continue
                } catch (e) { }
            }

            // 旧格式：目录内部的 _cleanc_metadata.json
            if (entry.isDirectory()) {
                const oldMetaPath = path.join(itemPath, '_cleanc_metadata.json')
                try {
                    const metadata = JSON.parse(fs.readFileSync(oldMetaPath, 'utf8'))
                    const size = getDirSizeExact(itemPath)

                    items.push({
                        id: entry.name,
                        originalPath: metadata.originalPath,
                        movedAt: metadata.movedAt,
                        size: size,
                        recoveryPath: itemPath,
                        isDirectory: true
                    })
                } catch (e) { }
            }
        }
    } catch (e) {
        console.error('[RECOVERY] Failed to read recovery zone:', e.message)
    }

    return items.sort((a, b) => new Date(b.movedAt) - new Date(a.movedAt))
}

// 从恢复区恢复
function restoreFromRecoveryZone(recoveryPath) {
    try {
        // 检查新格式（.meta.json 在文件旁边）
        const newMetaPath = recoveryPath + '.meta.json'
        const oldMetaPath = path.join(recoveryPath, '_cleanc_metadata.json')

        let metadata
        let isNewFormat = false

        if (fs.existsSync(newMetaPath)) {
            metadata = JSON.parse(fs.readFileSync(newMetaPath, 'utf8'))
            isNewFormat = true
        } else if (fs.existsSync(oldMetaPath)) {
            metadata = JSON.parse(fs.readFileSync(oldMetaPath, 'utf8'))
        } else {
            return { success: false, error: '找不到元数据文件' }
        }

        const originalPath = metadata.originalPath
        const stats = fs.statSync(recoveryPath)

        if (isNewFormat) {
            // 新格式：直接移动文件/文件夹回原位置
            const originalDir = path.dirname(originalPath)
            fs.mkdirSync(originalDir, { recursive: true })

            if (stats.isDirectory()) {
                // 目录：使用 PowerShell 移动
                const result = require('child_process').execSync(
                    `powershell -NoProfile -Command "Move-Item -Path '${recoveryPath.replace(/'/g, "''")}' -Destination '${originalPath.replace(/'/g, "''")}' -Force"`,
                    { timeout: 180000 }
                )
            } else {
                // 文件：复制后删除
                fs.copyFileSync(recoveryPath, originalPath)
                fs.unlinkSync(recoveryPath)
            }

            // 删除元数据文件
            fs.unlinkSync(newMetaPath)

            console.log(`[RESTORE] Restored to ${originalPath}`)
            return { success: true, restoredSize: metadata.size || 0 }
        } else {
            // 旧格式：目录内部有元数据
            fs.mkdirSync(originalPath, { recursive: true })

            const entries = fs.readdirSync(recoveryPath, { withFileTypes: true })
            let restoredSize = 0

            for (const entry of entries) {
                if (entry.name === '_cleanc_metadata.json') continue

                const srcPath = path.join(recoveryPath, entry.name)
                const destPath = path.join(originalPath, entry.name)

                try {
                    if (entry.isFile()) {
                        fs.copyFileSync(srcPath, destPath)
                        restoredSize += fs.statSync(srcPath).size
                        fs.unlinkSync(srcPath)
                    } else if (entry.isDirectory()) {
                        const result = moveDirectoryRecursive(srcPath, destPath)
                        restoredSize += result.size
                    }
                } catch (e) { }
            }

            // 删除恢复区条目
            fs.unlinkSync(oldMetaPath)
            fs.rmdirSync(recoveryPath)

            console.log(`[RESTORE] Restored ${(restoredSize / 1e6).toFixed(1)} MB to ${originalPath}`)
            return { success: true, restoredSize }
        }
    } catch (e) {
        console.error('[RESTORE] Failed:', e.message)
        return { success: false, error: e.message }
    }
}

// 从恢复区永久删除
function permanentDeleteFromRecoveryZone(recoveryPath) {
    try {
        const stats = fs.statSync(recoveryPath)
        const size = stats.isDirectory() ? getDirSizeExact(recoveryPath) : stats.size

        // 删除元数据文件（如果存在）
        const newMetaPath = recoveryPath + '.meta.json'
        if (fs.existsSync(newMetaPath)) {
            fs.unlinkSync(newMetaPath)
        }

        // 使用PowerShell强制删除
        return new Promise((resolve) => {
            exec(`powershell -NoProfile -Command "Remove-Item -Path '${recoveryPath.replace(/'/g, "''")}' -Recurse -Force"`,
                { timeout: 60000 }, (err) => {
                    if (err) {
                        console.error('[PERM-DELETE] Failed:', err.message)
                        resolve({ success: false, error: err.message })
                    } else {
                        console.log(`[PERM-DELETE] Deleted ${(size / 1e6).toFixed(1)} MB`)
                        resolve({ success: true, deletedSize: size })
                    }
                })
        })
    } catch (e) {
        return { success: false, error: e.message }
    }
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 860, minWidth: 960, minHeight: 680,
        backgroundColor: '#0a0e14',
        icon: path.join(__dirname, '../public/favicon.ico'),
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false },
        show: false
    })
    mainWindow.once('ready-to-show', () => mainWindow.show())

    if (isDev) {
        for (const port of [5173, 5174, 5175, 5176]) {
            try { await mainWindow.loadURL(`http://localhost:${port}`); console.log(`Loaded from ${port}`); break }
            catch (e) { continue }
        }
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
    }

    mainWindow.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); mainWindow.hide() } })
}

function createTray() {
    try {
        tray = new Tray(nativeImage.createEmpty())
        tray.setToolTip('CleanC')
        tray.setContextMenu(Menu.buildFromTemplate([
            { label: '打开', click: () => mainWindow?.show() },
            { type: 'separator' },
            { label: '退出', click: () => { app.isQuitting = true; app.quit() } }
        ]))
        tray.on('double-click', () => mainWindow?.show())
    } catch (e) { }
}

// ========== IPC ==========

// 检查管理员权限
ipcMain.handle('check-admin', async () => {
    return isAdmin()
})

// 请求管理员权限
ipcMain.handle('request-admin', async () => {
    if (!isAdmin()) {
        requestAdminRestart()
        return { restarting: true }
    }
    return { isAdmin: true }
})

ipcMain.handle('get-disk-info', async (e, drive = 'C:') => {
    return new Promise((resolve, reject) => {
        exec(`wmic logicaldisk where "DeviceID='${drive}'" get Size,FreeSpace /format:csv`, { encoding: 'utf8' },
            (err, stdout) => {
                if (err) return reject(err)
                const lines = stdout.trim().split('\n').filter(l => l.trim())
                if (lines.length >= 2) {
                    const p = lines[1].split(',')
                    resolve({ drive, total: parseInt(p[2]) || 0, free: parseInt(p[1]) || 0 })
                } else reject(new Error('Parse failed'))
            })
    })
})

// 精确扫描目录大小
ipcMain.handle('get-dir-size', async (e, dirPath) => {
    const p = expandEnvVars(dirPath)
    if (!fs.existsSync(p)) { console.log(`${path.basename(dirPath)}: 不存在`); return 0 }
    try {
        const size = getDirSizeExact(p) // 无深度限制
        console.log(`${path.basename(dirPath)}: ${(size / 1024 / 1024).toFixed(1)} MB`)
        return size
    } catch (e) { return 0 }
})

// 清理页面扫描取消标志
let scanCDriveCancelled = false

// 取消清理页面扫描
ipcMain.handle('cancel-scan-c-drive', async () => {
    scanCDriveCancelled = true
    console.log('[SCAN-C] Cancellation requested')
    return { success: true }
})

ipcMain.handle('scan-c-drive', async () => {
    console.log('Scanning C:...')
    scanCDriveCancelled = false

    const dirs = [
        { path: 'C:\\Users', name: 'Users', default: 50e9 },
        { path: 'C:\\Windows', name: 'Windows', default: 25e9 },
        { path: 'C:\\Program Files', name: 'Program Files', default: 15e9 },
        { path: 'C:\\Program Files (x86)', name: 'Program Files (x86)', default: 10e9 },
        { path: 'C:\\ProgramData', name: 'ProgramData', default: 5e9 }
    ]

    const results = []
    let processedCount = 0

    for (const d of dirs) {
        if (scanCDriveCancelled) break
        if (!fs.existsSync(d.path)) continue

        // 发送进度
        mainWindow?.webContents.send('scan-c-drive-progress', {
            current: d.name,
            progress: Math.floor((dirs.indexOf(d) / dirs.length) * 100)
        })

        try {
            // 获取所有一级子目录
            const entries = fs.readdirSync(d.path, { withFileTypes: true }).filter(e => e.isDirectory())
            let total = 0
            const children = []

            // 并行处理前20个最大的子目录（避免扫描太久）
            // 先快速获取大小用于排序
            const subDirs = []
            for (const sub of entries) {
                if (scanCDriveCancelled) break
                try {
                    // 仅对非隐藏/系统关键目录进行预检查
                    if (sub.name.startsWith('$') || sub.name === 'System Volume Information') continue
                    subDirs.push({ name: sub.name, path: path.join(d.path, sub.name) })
                } catch (e) { }
            }

            // 限制处理数量，防止卡死
            const targetSubs = subDirs.slice(0, 15)

            for (const sub of targetSubs) {
                if (scanCDriveCancelled) break

                // yield 控制权防止 UI 冻结
                await yieldControl()
                processedCount++

                try {
                    const size = getDirSizeExact(sub.path)
                    if (size > 10 * 1024 * 1024) { // > 10MB
                        let pushedAsSeparate = false

                        // 如果目录很大 (>1GB)，尝试"炸开"它，将其子目录作为独立的一级项显示
                        if (size > 1024 * 1024 * 1024) {
                            try {
                                const grandEntries = fs.readdirSync(sub.path, { withFileTypes: true })
                                    .filter(e => e.isDirectory())

                                let grandTotal = 0
                                for (const grand of grandEntries) {
                                    if (scanCDriveCancelled) break
                                    await yieldControl() // yield 防止冻结

                                    try {
                                        // 忽略系统目录
                                        if (grand.name === 'AppData' || grand.name.startsWith('.')) continue

                                        const grandPath = path.join(sub.path, grand.name)
                                        const grandSize = getDirSizeExact(grandPath)

                                        // 如果子文件夹足够大 (>100MB)，直接提升为一级显示
                                        if (grandSize > 100 * 1024 * 1024) {
                                            children.push({
                                                name: `${sub.name}/${grand.name}`, // 显示路径如 "徐/Downloads"
                                                value: grandSize,
                                                path: grandPath
                                            })
                                            grandTotal += grandSize
                                        }
                                    } catch (e) { }
                                }

                                // 把剩余没被提升的部分作为一个整体
                                const remaining = size - grandTotal
                                if (remaining > 10 * 1024 * 1024) {
                                    children.push({
                                        name: `${sub.name} (其他)`,
                                        value: remaining,
                                        path: sub.path
                                    })
                                }
                                pushedAsSeparate = true
                            } catch (e) { }
                        }

                        // 如果没有被炸开，就作为普通一项添加
                        if (!pushedAsSeparate) {
                            children.push({
                                name: sub.name,
                                value: size,
                                path: sub.path
                            })
                        }

                        total += size
                    }
                } catch (e) { }
            }

            children.sort((a, b) => b.value - a.value)
            results.push({
                name: d.name,
                value: total > 0 ? total : d.default,
                path: d.path,
                children: children
            })
        } catch (e) { }
    }

    if (scanCDriveCancelled) {
        console.log('[SCAN-C] Cancelled')
        return { cancelled: true, results: [] }
    }

    results.sort((a, b) => b.value - a.value)
    console.log('Scan done!')
    return results
})

// 智能建议
ipcMain.handle('get-smart-suggestions', async () => {
    const suggestions = []

    const dl = path.join(os.homedir(), 'Downloads')
    try {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
        let oldSize = 0, oldCount = 0
        for (const e of fs.readdirSync(dl, { withFileTypes: true })) {
            if (e.isFile()) try {
                const s = fs.statSync(path.join(dl, e.name))
                if (s.mtime.getTime() < cutoff) { oldSize += s.size; oldCount++ }
            } catch (e) { }
        }
        if (oldSize > 10e6) suggestions.push({
            id: 'downloads', type: 'download', icon: '📥', title: '下载文件夹旧文件',
            description: `${oldCount} 个超过30天的文件`, size: oldSize, path: dl,
            actions: [{ label: '打开', type: 'primary', action: 'open' }]
        })
    } catch (e) { }

    // Desktop - 检查大文件
    const dt = path.join(os.homedir(), 'Desktop')
    try {
        const largeFiles = []
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
        const files = fs.readdirSync(dt, { withFileTypes: true })

        for (const e of files) {
            if (e.isFile()) {
                try {
                    const s = fs.statSync(path.join(dt, e.name))
                    // > 500MB 且 > 30天未修改
                    if (s.size > 500 * 1024 * 1024 && s.mtime.getTime() < cutoff) {
                        largeFiles.push(e.name)
                    }
                } catch (e) { }
            }
        }

        if (largeFiles.length > 0) {
            suggestions.push({
                id: 'desktop_large',
                type: 'desktop',
                icon: '🖥️',
                title: '桌面大文件建议',
                description: `发现 ${largeFiles.length} 个长期未动的大文件 (>500MB)`,
                size: 0, // 仅提示，不作为清理总大小
                path: dt,
                actions: [{ label: '前往查看', type: 'primary', action: 'open' }]
            })
        }
    } catch (e) { console.log('Desktop scan error:', e) }

    console.log(`Found ${suggestions.length} suggestions`)
    return suggestions
})

// 直接删除目录内容 - 使用简单的 PowerShell 命令
function directDeletePath(targetPath) {
    return new Promise((resolve) => {
        const ep = expandEnvVars(targetPath)

        if (!fs.existsSync(ep)) {
            console.log(`[DELETE] Path not found: ${ep}`)
            return resolve({ success: true, freedSpace: 0 })
        }

        // 计算删除前大小
        const sizeBefore = getDirSizeExact(ep)
        console.log(`[DELETE] Starting delete: ${ep} (${(sizeBefore / 1e6).toFixed(1)} MB)`)

        // 简单直接的 PowerShell 命令
        const cmd = `powershell -NoProfile -Command "Get-ChildItem -Path '${ep.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"`

        console.log(`[DELETE] Executing: ${cmd}`)

        exec(cmd, { timeout: 180000 }, (err, stdout, stderr) => {
            // 无论是否报错都检查实际结果
            const sizeAfter = fs.existsSync(ep) ? getDirSizeExact(ep) : 0
            const freedSpace = Math.max(0, sizeBefore - sizeAfter)

            console.log(`[DELETE] Before: ${(sizeBefore / 1e6).toFixed(1)} MB, After: ${(sizeAfter / 1e6).toFixed(1)} MB, Freed: ${(freedSpace / 1e6).toFixed(1)} MB`)

            if (err) {
                console.log(`[DELETE] PowerShell error (may be partial): ${err.message}`)
            }
            if (stderr) {
                console.log(`[DELETE] stderr: ${stderr}`)
            }

            resolve({ success: true, freedSpace })
        })
    })
}

// 清理 = 直接删除
ipcMain.handle('delete-path', async (e, p, itemId) => {
    console.log(`[IPC] delete-path called with: ${p}`)
    const result = await directDeletePath(p)
    console.log(`[IPC] delete-path result:`, result)
    return result
})

// 获取恢复区内容
ipcMain.handle('get-recovery-items', async () => {
    return getRecoveryZoneItems()
})

// 从恢复区恢复
ipcMain.handle('restore-item', async (e, recoveryPath) => {
    return restoreFromRecoveryZone(recoveryPath)
})

// 永久删除
ipcMain.handle('permanent-delete', async (e, recoveryPath) => {
    return await permanentDeleteFromRecoveryZone(recoveryPath)
})

ipcMain.handle('open-folder', async (e, p) => {
    shell.openPath(expandEnvVars(p))
    return { success: true }
})

// 请求管理员权限重启
ipcMain.handle('request-admin-restart', async () => {
    requestAdminRestart()
    return { success: true }
})

// 获取管理员状态
ipcMain.handle('get-admin-status', async () => {
    return isAdmin()
})

// ========== 大文件扫描器 ==========

// 删除建议分类规则
const DELETE_RULES = {
    // 安全删除 - 临时文件和缓存
    safe: [
        // 基本临时/缓存目录
        /[\\\/]Temp$/i,
        /[\\\/]Temp[\\\/]/i,
        /[\\\/]Cache$/i,
        /[\\\/]cache$/i,
        /[\\\/]Cache[\\\/]/i,
        /[\\\/]Caches$/i,
        /[\\\/]Caches[\\\/]/i,
        /[\\\/]\.cache$/i,
        /[\\\/]\.cache[\\\/]/i,
        /[\\\/]CrashDumps$/i,
        /[\\\/]CrashDumps[\\\/]/i,
        /[\\\/]Logs$/i,
        /[\\\/]Logs[\\\/]/i,
        /\.tmp$/i,
        /\.log$/i,
        /\.bak$/i,
        /\.old$/i,
        /Thumbs\.db$/i,
        /desktop\.ini$/i,

        // Node.js / npm
        /[\\\/]npm-cache$/i,
        /[\\\/]npm-cache[\\\/]/i,
        /[\\\/]node_modules$/i,
        /[\\\/]node_modules[\\\/]/i,

        // Python 缓存（注：venv/site-packages 在函数中特殊处理为 caution）
        /[\\\/]__pycache__$/i,
        /[\\\/]__pycache__[\\\/]/i,
        /[\\\/]uv$/i,
        /[\\\/]uv[\\\/]/i,
        /[\\\/]pip[\\\/]cache/i,

        // 其他开发工具缓存
        /[\\\/]\.nuget$/i,
        /[\\\/]\.gradle[\\\/]caches/i,
        /[\\\/]huggingface$/i,
        /[\\\/]huggingface[\\\/]/i,
        /[\\\/]torch[\\\/]hub$/i,
        /[\\\/]Installer$/i,

        // 系统临时目录
        /[\\\/]AppData[\\\/]Local[\\\/]Temp$/i,
        /[\\\/]AppData[\\\/]Local[\\\/]Temp[\\\/]/i,
        /[\\\/]Windows[\\\/]Temp$/i,
        /[\\\/]Windows[\\\/]Temp[\\\/]/i,
        /[\\\/]SoftwareDistribution[\\\/]Download/i,

        // 浏览器缓存和 AI 模型缓存
        /[\\\/]Chrome[\\\/]User Data[\\\/].*[\\\/]Cache/i,
        /[\\\/]Edge[\\\/]User Data[\\\/].*[\\\/]Cache/i,
        /[\\\/]OptGuideOnDeviceModel[\\\/]/i,  // Chrome AI 模型
        /[\\\/]ProvenanceData[\\\/]/i,         // Edge AI 模型
        /[\\\/]crx_cache[\\\/]/i,              // 浏览器扩展缓存
        /[\\\/]component_crx_cache[\\\/]/i,
        /[\\\/]CachedExtensionVSIXs[\\\/]/i,   // VS Code 扩展缓存
        /[\\\/]CachedExtensionVSIXs$/i,

        // NVIDIA 旧版安装包
        /[\\\/]NVIDIA[\\\/].*[\\\/]ota-artifacts[\\\/]/i,
        /[\\\/]UpdateFramework[\\\/]ota-artifacts[\\\/]/i,

        // 其他可清理项
        /[\\\/]electron[\\\/]Cache$/i,
        /[\\\/]Microsoft[\\\/]Edge[\\\/].*[\\\/]Cache/i,
    ],
    // 谨慎删除 - 用户文件（需要用户确认）
    caution: [
        /[\\\/]Downloads$/i,
        /[\\\/]Downloads[\\\/]/i,
        /[\\\/]Documents[\\\/]/i,
        /[\\\/]Desktop[\\\/]/i,
        /[\\\/]Videos[\\\/]/i,
        /[\\\/]Pictures[\\\/]/i,
        /[\\\/]Music[\\\/]/i,
        /\.zip$/i,
        /\.rar$/i,
        /\.7z$/i,
        /\.iso$/i,
        /\.mp4$/i,
        /\.mkv$/i,
        /\.avi$/i,
        /\.mov$/i,
        /\.pdf$/i,
        /\.doc$/i,
        /\.docx$/i,
        /\.ppt$/i,
        /\.pptx$/i,
        /\.xls$/i,
        /\.xlsx$/i,
        /\.safetensors$/i,
        /\.ckpt$/i,
        /\.bin$/i,
        /\.pth$/i,
    ],
    // 不建议删除 - 系统/程序文件
    danger: [
        /[\\\/]Windows[\\\/]System32/i,
        /[\\\/]Windows[\\\/]SysWOW64/i,
        /[\\\/]Windows[\\\/]WinSxS/i,
        /\.exe$/i,
        /\.dll$/i,
        /\.sys$/i,
        /\.msi$/i,
        /[\\\/]\$Recycle\.Bin[\\\/]/i,
        /[\\\/]System Volume Information[\\\/]/i,
    ]
}

// 获取删除建议 - 智能多条件判断
function getDeleteRecommendation(filePath) {
    const lowerPath = filePath.toLowerCase()
    const fileName = path.basename(filePath).toLowerCase()
    const ext = path.extname(fileName).toLowerCase()

    // ===== 特殊规则：需要先判断 =====

    // 1. NVIDIA ota-artifacts: 只有安装包(.exe)可以删，驱动文件(.dll/.sys)不能删
    if (/ota-artifacts/i.test(lowerPath)) {
        if (ext === '.exe' || ext === '.zip') {
            return { level: 'safe', label: '可安全删除', labelEn: 'Safe to delete', color: '#10b981', description: '旧版驱动安装包', descriptionEn: 'Old driver package' }
        } else if (ext === '.dll' || ext === '.sys' || ext === '.so') {
            return { level: 'danger', label: '不建议删除', labelEn: 'Not recommended', color: '#ef4444', description: '显卡驱动组件文件', descriptionEn: 'GPU driver component' }
        }
    }

    // 2. Python 虚拟环境依赖：是依赖而非缓存，需谨慎
    if (/[\\\/]\.?venv[\\\/].*site-packages[\\\/]/i.test(lowerPath)) {
        return { level: 'caution', label: '环境依赖', labelEn: 'Environment dep', color: '#f59e0b', description: '删除后该虚拟环境将无法运行', descriptionEn: 'Venv will break if deleted' }
    }

    // 3. Chrome/Edge AI 模型缓存：可删但会重新下载
    if (/OptGuideOnDeviceModel/i.test(lowerPath) || /ProvenanceData/i.test(lowerPath)) {
        return { level: 'safe', label: '可删除', labelEn: 'Can delete', color: '#10b981', description: '浏览器 AI 模型缓存，删除后将重新下载', descriptionEn: 'Browser AI cache, will re-download' }
    }

    // ===== 危险文件扩展名 =====
    if (['.dll', '.sys', '.exe', '.msi'].includes(ext)) {
        // 但这些位置的可以删
        if (/[\\\/]Temp[\\\/]/i.test(lowerPath) ||
            /[\\\/]Cache[\\\/]/i.test(lowerPath) ||
            /[\\\/]npm-cache[\\\/]/i.test(lowerPath) ||
            /[\\\/]-updater[\\\/]/i.test(lowerPath)) {
            // 临时目录或缓存中的安装包可以删
            if (ext === '.exe') {
                return { level: 'safe', label: '可安全删除', labelEn: 'Safe to delete', color: '#10b981', description: '临时安装包', descriptionEn: 'Temp installer' }
            }
        }
        // 其他位置的不建议删
        return { level: 'danger', label: '不建议删除', labelEn: 'Not recommended', color: '#ef4444', description: '系统或程序文件', descriptionEn: 'System/program file' }
    }

    // ===== 安全规则 =====
    for (const pattern of DELETE_RULES.safe) {
        if (pattern.test(filePath)) {
            return { level: 'safe', label: '可安全删除', labelEn: 'Safe to delete', color: '#10b981', description: '临时文件或缓存', descriptionEn: 'Temp file or cache' }
        }
    }

    // ===== 谨慎规则 =====
    for (const pattern of DELETE_RULES.caution) {
        if (pattern.test(filePath)) {
            return { level: 'caution', label: '谨慎删除', labelEn: 'Caution', color: '#f59e0b', description: '用户文件，请确认后删除', descriptionEn: 'User file, confirm before deleting' }
        }
    }

    // ===== 危险规则 =====
    for (const pattern of DELETE_RULES.danger) {
        if (pattern.test(filePath)) {
            return { level: 'danger', label: '不建议删除', labelEn: 'Not recommended', color: '#ef4444', description: '系统或程序文件', descriptionEn: 'System/program file' }
        }
    }

    // 默认未知
    return { level: 'unknown', label: '需确认', labelEn: 'Verify', color: '#6b7280', description: '请检查文件内容后决定', descriptionEn: 'Check file content before deciding' }
}

// 扫描取消标志
let scanCancelled = false

// 取消扫描 IPC
ipcMain.handle('cancel-scan', async () => {
    scanCancelled = true
    console.log('[SCAN] Cancellation requested')
    return { success: true }
})

// 辅助函数：yield 控制权避免 UI 冻结
function yieldControl() {
    return new Promise(resolve => setImmediate(resolve))
}

// 扫描大文件 - 异步版本，支持取消和防止 UI 冻结
ipcMain.handle('scan-large-files', async (e, options = {}) => {
    const minSize = options.minSize || 100 * 1024 * 1024 // 默认 100MB
    const excludeDirs = options.excludeDirs || []
    const maxResults = options.maxResults || 200

    scanCancelled = false // 重置取消标志
    const startTime = Date.now()
    console.log(`[SCAN] Starting large file scan (min: ${(minSize / 1e6).toFixed(0)} MB)`)
    console.log(`[SCAN] Exclude dirs:`, excludeDirs)

    const results = []
    let scannedCount = 0
    let lastProgressUpdate = 0
    let lastYield = 0

    // 发送进度更新
    function sendProgress(currentPath) {
        const now = Date.now()
        if (now - lastProgressUpdate > 200) { // 每200ms更新一次
            lastProgressUpdate = now
            mainWindow?.webContents.send('scan-progress', {
                scanned: scannedCount,
                found: results.length,
                currentPath: currentPath,
                elapsedTime: Math.floor((now - startTime) / 1000)
            })
        }
    }

    // 递归扫描 - 异步版本，支持取消和 yield
    async function scanDir(dirPath, depth = 0) {
        if (depth > 20) return
        if (results.length >= maxResults) return
        if (scanCancelled) return // 检查取消

        // 检查排除列表
        for (const exclude of excludeDirs) {
            if (exclude && dirPath.toLowerCase().includes(exclude.toLowerCase())) {
                return
            }
        }

        // 跳过系统保护目录
        const skipDirs = ['$Recycle.Bin', 'System Volume Information', '$WinREAgent', 'Recovery', 'Config.Msi', 'Windows Defender']
        const dirName = path.basename(dirPath)
        if (skipDirs.includes(dirName)) return

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true })

            for (const entry of entries) {
                if (results.length >= maxResults) return
                if (scanCancelled) return // 检查取消

                const fullPath = path.join(dirPath, entry.name)
                scannedCount++

                // 每100项 yield 一次控制权，防止 UI 冻结
                if (scannedCount - lastYield >= 100) {
                    lastYield = scannedCount
                    await yieldControl()
                    sendProgress(dirPath)
                }

                if (scannedCount % 500 === 0) {
                    sendProgress(dirPath)
                }

                try {
                    if (entry.isFile()) {
                        const stats = fs.statSync(fullPath)
                        if (stats.size >= minSize) {
                            const recommendation = getDeleteRecommendation(fullPath)
                            results.push({
                                path: fullPath,
                                name: entry.name,
                                size: stats.size,
                                isDirectory: false,
                                modifiedTime: stats.mtime.toISOString(),
                                recommendation
                            })
                        }
                    } else if (entry.isDirectory()) {
                        // 递归扫描子目录，但不直接将目录加入结果
                        // 只有特定类型的"终端"文件夹才添加（缓存、临时文件夹等）
                        const isTerminalFolder = /^(node_modules|cache|\.cache|__pycache__|\.git|Temp|Logs|CrashDumps|npm-cache|huggingface|torch|\.nuget|Installer|uv)$/i.test(entry.name)

                        if (isTerminalFolder) {
                            // 这些是可以整体删除的文件夹
                            const dirSize = getDirSizeExact(fullPath)
                            if (dirSize >= minSize) {
                                const recommendation = getDeleteRecommendation(fullPath)
                                results.push({
                                    path: fullPath,
                                    name: entry.name,
                                    size: dirSize,
                                    isDirectory: true,
                                    modifiedTime: new Date().toISOString(),
                                    recommendation
                                })
                            }
                            // 不再递归进入这些文件夹
                        } else {
                            // 继续递归扫描
                            await scanDir(fullPath, depth + 1)
                        }
                    }
                } catch (e) {
                    // 忽略访问错误
                }
            }
        } catch (e) {
            // 忽略目录访问错误
        }
    }

    // 从 C 盘主要目录开始扫描 - 恢复完整扫描
    const rootDirs = ['C:\\Users', 'C:\\ProgramData', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\Windows\\Temp', 'C:\\Windows\\SoftwareDistribution']

    for (const root of rootDirs) {
        if (scanCancelled) break // 检查取消
        if (fs.existsSync(root)) {
            console.log(`[SCAN] Scanning ${root}...`)
            mainWindow?.webContents.send('scan-progress', {
                scanned: scannedCount,
                found: results.length,
                currentPath: root,
                elapsedTime: Math.floor((Date.now() - startTime) / 1000)
            })
            await scanDir(root, 0)
            if (results.length >= maxResults) break
        }
    }

    // 按大小排序
    results.sort((a, b) => b.size - a.size)

    const duration = Math.floor((Date.now() - startTime) / 1000)

    if (scanCancelled) {
        console.log(`[SCAN] Cancelled after ${duration}s (scanned ${scannedCount} entries)`)
        return {
            success: false,
            cancelled: true,
            results: [],
            scannedCount,
            duration
        }
    }

    console.log(`[SCAN] Complete. Found ${results.length} large items in ${duration}s (scanned ${scannedCount} entries)`)

    return {
        success: true,
        results: results.slice(0, maxResults),
        scannedCount,
        totalSize: results.reduce((sum, r) => sum + r.size, 0),
        duration
    }
})

// 获取排除目录列表（可持久化）
ipcMain.handle('get-exclude-dirs', async () => {
    // 默认排除目录 - 系统关键组件，防止误删导致系统崩溃
    return [
        // 用户游戏目录
        'C:\\Program Files\\Steam',
        'C:\\Games',
        // 显卡驱动 (NVIDIA)
        'C:\\Program Files\\NVIDIA Corporation',
        'C:\\Program Files (x86)\\NVIDIA Corporation',
        'C:\\Windows\\System32\\DriverStore\\FileRepository\\nv',
        // 显卡驱动 (AMD/ATI)
        'C:\\Program Files\\AMD',
        'C:\\Program Files (x86)\\AMD',
        'C:\\AMD',
        // 显卡驱动 (Intel)
        'C:\\Program Files\\Intel',
        'C:\\Program Files (x86)\\Intel',
        // 声卡驱动 (Realtek)
        'C:\\Program Files\\Realtek',
        'C:\\Program Files (x86)\\Realtek',
        // 运行时库 (Visual C++ Redistributable)
        'C:\\Program Files\\Microsoft Visual Studio',
        'C:\\Program Files (x86)\\Microsoft Visual Studio',
        // .NET Framework
        'C:\\Windows\\Microsoft.NET',
        'C:\\Program Files\\dotnet',
        // 系统关键目录
        'C:\\Windows\\System32',
        'C:\\Windows\\SysWOW64',
        'C:\\Windows\\WinSxS',
        // 启动项
        'C:\\Windows\\Boot',
        'C:\\Recovery',
    ]
})

// 删除指定路径 - 改进错误处理
ipcMain.handle('delete-large-file', async (e, filePath, isDirectory) => {
    console.log(`[DELETE] Deleting: ${filePath} (isDir: ${isDirectory})`)

    try {
        // 获取删除前的大小
        let sizeBefore = 0
        try {
            sizeBefore = isDirectory ? getDirSizeExact(filePath) : fs.statSync(filePath).size
        } catch (e) {
            // 文件可能已不存在
        }

        if (isDirectory) {
            // 使用 PowerShell 删除目录 - 忽略错误继续删除
            await new Promise((resolve) => {
                const ps = spawn('powershell', [
                    '-NoProfile',
                    '-Command',
                    `Get-ChildItem -Path '${filePath.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue; Remove-Item -Path '${filePath.replace(/'/g, "''")}' -Force -Recurse -ErrorAction SilentlyContinue`
                ], { timeout: 180000 })

                ps.on('close', () => resolve())
                ps.on('error', () => resolve())
            })
        } else {
            try {
                fs.unlinkSync(filePath)
            } catch (e) {
                console.log(`[DELETE] Could not delete file: ${e.message}`)
            }
        }

        // 计算实际释放的空间（删除前 - 删除后）
        let sizeAfter = 0
        try {
            if (fs.existsSync(filePath)) {
                sizeAfter = isDirectory ? getDirSizeExact(filePath) : fs.statSync(filePath).size
            }
        } catch (e) {
            // 文件已不存在，说明完全删除成功
            sizeAfter = 0
        }

        const freedSpace = sizeBefore - sizeAfter
        const deleted = !fs.existsSync(filePath)

        if (freedSpace > 0 || deleted) {
            console.log(`[DELETE] Success: freed ${(freedSpace / 1e6).toFixed(1)} MB (${deleted ? '已完全删除' : '部分删除'})`)
            return {
                success: true,
                freedSpace,
                deleted,
                message: deleted ? '已完全删除' : `部分删除，释放 ${(freedSpace / 1e6).toFixed(1)} MB`
            }
        } else {
            console.log(`[DELETE] Failed: no space freed`)
            return { success: false, error: '无法删除（可能被占用）' }
        }
    } catch (e) {
        console.error(`[DELETE] Failed:`, e.message)
        return { success: false, error: e.message }
    }
})

// 移动文件到恢复区（用于谨慎删除项）
ipcMain.handle('move-to-recovery-zone', async (e, filePath, isDirectory) => {
    console.log(`[RECOVERY] Moving to recovery zone: ${filePath}`)

    try {
        ensureRecoveryZone()

        const fileName = path.basename(filePath)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const destName = `${timestamp}_${fileName}`
        const destPath = path.join(RECOVERY_ZONE, destName)

        // 获取原始大小
        let originalSize = 0
        try {
            originalSize = isDirectory ? getDirSizeExact(filePath) : fs.statSync(filePath).size
        } catch (e) { }

        // 移动文件/文件夹（跨驱动器需要复制+删除）
        if (isDirectory) {
            // 使用 PowerShell 移动目录（支持跨驱动器）
            await new Promise((resolve, reject) => {
                exec(`powershell -NoProfile -Command "Move-Item -Path '${filePath.replace(/'/g, "''")}' -Destination '${destPath.replace(/'/g, "''")}' -Force"`,
                    { timeout: 180000 }, (err) => {
                        if (err) reject(err)
                        else resolve()
                    })
            })
        } else {
            // 单个文件：复制后删除（支持跨驱动器）
            fs.copyFileSync(filePath, destPath)
            fs.unlinkSync(filePath)
        }

        // 保存原始路径信息（用于恢复）
        const metaPath = destPath + '.meta.json'
        fs.writeFileSync(metaPath, JSON.stringify({
            originalPath: filePath,
            movedAt: new Date().toISOString(),
            size: originalSize,
            isDirectory
        }, null, 2))

        console.log(`[RECOVERY] Success: moved to ${destPath}`)
        return {
            success: true,
            freedSpace: originalSize,
            recoveryPath: destPath,
            message: '已移至恢复区'
        }
    } catch (e) {
        console.error(`[RECOVERY] Failed:`, e.message)
        return { success: false, error: e.message }
    }
})

// App
app.whenReady().then(() => {
    console.log('Admin mode:', isAdmin())
    ensureRecoveryZone()
    createWindow()
    createTray()
})

app.on('window-all-closed', () => { })
app.on('activate', () => mainWindow ? mainWindow.show() : createWindow())
app.on('before-quit', () => { app.isQuitting = true })

