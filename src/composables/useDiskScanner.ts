import { ref } from 'vue'
import { useLanguage } from './useLanguage'

const isElectron = typeof window !== 'undefined' &&
    typeof (window as any).require === 'function'

let ipcRenderer: any = null
if (isElectron) {
    try {
        const { ipcRenderer: ipc } = (window as any).require('electron')
        ipcRenderer = ipc
        console.log('Running in Electron mode')
    } catch (e) {
        console.log('Not running in Electron')
    }
}

export interface DiskInfo {
    drive: string
    total: number
    used: number
    free: number
    cleanable: number
}

export interface FolderData {
    name: string
    value: number
    path: string
    children?: FolderData[]
}

export interface CleanableItem {
    id: string
    name: string
    path: string
    size: number
    description: string
    icon: string
    safe: boolean
    selected: boolean
}

// 清理进度信息
export interface CleaningProgress {
    current: number
    total: number
    currentItem: string
    freedSpace: number
}

interface CleanableRule {
    id: string
    name: string
    nameEn: string
    path: string
    description: string
    descriptionEn: string
    icon: string
    safe: boolean
}

// 清理规则库
const CLEANABLE_RULES: CleanableRule[] = [
    { id: 'temp', name: '用户临时文件', nameEn: 'User Temp Files', path: '%TEMP%', description: '应用程序临时文件', descriptionEn: 'Application temp files', icon: '🗂️', safe: true },
    { id: 'win_temp', name: '系统临时文件', nameEn: 'System Temp Files', path: 'C:\\Windows\\Temp', description: 'Windows系统临时文件', descriptionEn: 'Windows system temp', icon: '📄', safe: true },
    { id: 'windows_update', name: 'Windows 更新缓存', nameEn: 'Windows Update Cache', path: 'C:\\Windows\\SoftwareDistribution\\Download', description: '已安装的更新包', descriptionEn: 'Installed update packages', icon: '🔄', safe: true },
    { id: 'prefetch', name: '预读取文件', nameEn: 'Prefetch Files', path: 'C:\\Windows\\Prefetch', description: '程序启动缓存', descriptionEn: 'Program launch cache', icon: '⚡', safe: true },
    { id: 'cbs_logs', name: 'CBS 日志', nameEn: 'CBS Logs', path: 'C:\\Windows\\Logs\\CBS', description: 'Windows组件日志', descriptionEn: 'Windows component logs', icon: '📋', safe: true },
    { id: 'panther', name: 'Windows 安装日志', nameEn: 'Windows Install Logs', path: 'C:\\Windows\\Panther', description: '安装/升级日志', descriptionEn: 'Install/upgrade logs', icon: '📝', safe: true },
    { id: 'memory_dumps', name: '内存转储', nameEn: 'Memory Dumps', path: 'C:\\Windows\\Minidump', description: '蓝屏转储文件', descriptionEn: 'BSOD dump files', icon: '💥', safe: true },
    { id: 'windows_old', name: 'Windows.old', nameEn: 'Windows.old', path: 'C:\\Windows.old', description: '旧系统备份', descriptionEn: 'Old system backup', icon: '🗃️', safe: true },
    { id: 'thumbnail', name: '缩略图缓存', nameEn: 'Thumbnail Cache', path: '%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer', description: '文件预览缩略图', descriptionEn: 'File preview thumbnails', icon: '🖼️', safe: true },
    { id: 'crash_dumps', name: '程序崩溃报告', nameEn: 'Crash Reports', path: '%LOCALAPPDATA%\\CrashDumps', description: '崩溃转储文件', descriptionEn: 'Crash dump files', icon: '💔', safe: true },
    { id: 'wer', name: 'Windows 错误报告', nameEn: 'Windows Error Reports', path: '%LOCALAPPDATA%\\Microsoft\\Windows\\WER', description: '错误报告缓存', descriptionEn: 'Error report cache', icon: '⚠️', safe: true },
    { id: 'temp_internet', name: 'Internet 临时文件', nameEn: 'Internet Temp Files', path: '%LOCALAPPDATA%\\Microsoft\\Windows\\INetCache', description: 'IE/Edge缓存', descriptionEn: 'IE/Edge cache', icon: '🌐', safe: true },
    { id: 'recent', name: '最近文档记录', nameEn: 'Recent Documents', path: '%APPDATA%\\Microsoft\\Windows\\Recent', description: '最近打开的文件', descriptionEn: 'Recently opened files', icon: '📁', safe: true },
    { id: 'chrome_cache', name: 'Chrome 缓存', nameEn: 'Chrome Cache', path: '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cache', description: 'Chrome浏览器缓存', descriptionEn: 'Chrome browser cache', icon: '🔴', safe: true },
    { id: 'chrome_code', name: 'Chrome 代码缓存', nameEn: 'Chrome Code Cache', path: '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Code Cache', description: 'Chrome JS缓存', descriptionEn: 'Chrome JS cache', icon: '🔴', safe: true },
    { id: 'edge_cache', name: 'Edge 缓存', nameEn: 'Edge Cache', path: '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Cache', description: 'Edge浏览器缓存', descriptionEn: 'Edge browser cache', icon: '🔵', safe: true },
    { id: 'edge_code', name: 'Edge 代码缓存', nameEn: 'Edge Code Cache', path: '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Code Cache', description: 'Edge JS缓存', descriptionEn: 'Edge JS cache', icon: '🔵', safe: true },
    { id: 'firefox', name: 'Firefox 缓存', nameEn: 'Firefox Cache', path: '%LOCALAPPDATA%\\Mozilla\\Firefox\\Profiles', description: 'Firefox缓存', descriptionEn: 'Firefox cache', icon: '🦊', safe: true },
    { id: 'npm', name: 'NPM 缓存', nameEn: 'NPM Cache', path: '%APPDATA%\\npm-cache', description: 'Node.js包缓存', descriptionEn: 'Node.js package cache', icon: '📦', safe: true },
    { id: 'yarn', name: 'Yarn 缓存', nameEn: 'Yarn Cache', path: '%LOCALAPPDATA%\\Yarn\\Cache', description: 'Yarn包缓存', descriptionEn: 'Yarn package cache', icon: '🧶', safe: true },
    { id: 'pip', name: 'Pip 缓存', nameEn: 'Pip Cache', path: '%LOCALAPPDATA%\\pip\\cache', description: 'Python包缓存', descriptionEn: 'Python package cache', icon: '🐍', safe: true },
    { id: 'nuget', name: 'NuGet 缓存', nameEn: 'NuGet Cache', path: '%LOCALAPPDATA%\\NuGet\\Cache', description: '.NET包缓存', descriptionEn: '.NET package cache', icon: '📚', safe: true },
    { id: 'gradle', name: 'Gradle 缓存', nameEn: 'Gradle Cache', path: '%USERPROFILE%\\.gradle\\caches', description: 'Java构建缓存', descriptionEn: 'Java build cache', icon: '🐘', safe: true },
    { id: 'maven', name: 'Maven 缓存', nameEn: 'Maven Cache', path: '%USERPROFILE%\\.m2\\repository', description: 'Maven缓存', descriptionEn: 'Maven cache', icon: '☕', safe: true },
    { id: 'vscode_cache', name: 'VSCode 缓存', nameEn: 'VSCode Cache', path: '%APPDATA%\\Code\\Cache', description: 'VS Code缓存', descriptionEn: 'VS Code cache', icon: '💙', safe: true },
    { id: 'vscode_data', name: 'VSCode 缓存数据', nameEn: 'VSCode Cached Data', path: '%APPDATA%\\Code\\CachedData', description: 'VS Code编译缓存', descriptionEn: 'VS Code compiled cache', icon: '💙', safe: true },
    { id: 'teams', name: 'Teams 缓存', nameEn: 'Teams Cache', path: '%APPDATA%\\Microsoft\\Teams\\Cache', description: 'Teams缓存', descriptionEn: 'Teams cache', icon: '👥', safe: true },
    { id: 'discord', name: 'Discord 缓存', nameEn: 'Discord Cache', path: '%APPDATA%\\discord\\Cache', description: 'Discord缓存', descriptionEn: 'Discord cache', icon: '💬', safe: true },
    { id: 'spotify', name: 'Spotify 缓存', nameEn: 'Spotify Cache', path: '%LOCALAPPDATA%\\Spotify\\Data', description: '音乐缓存', descriptionEn: 'Music cache', icon: '🎵', safe: true },
    { id: 'wechat', name: '微信文件缓存', nameEn: 'WeChat Files', path: '%USERPROFILE%\\Documents\\WeChat Files', description: '微信接收的文件', descriptionEn: 'WeChat received files', icon: '💚', safe: false },
    { id: 'downloads', name: '下载文件夹', nameEn: 'Downloads Folder', path: '%USERPROFILE%\\Downloads', description: '下载的文件', descriptionEn: 'Downloaded files', icon: '📥', safe: false },
    { id: 'installer', name: '安装包缓存', nameEn: 'Installer Cache', path: 'C:\\Windows\\Installer\\$PatchCache$', description: '安装程序补丁', descriptionEn: 'Installer patches', icon: '📀', safe: true }
]

export function useDiskScanner() {
    const isScanning = ref(false)
    const isCleaning = ref(false)
    const scanProgress = ref(0)
    const cleaningProgress = ref<CleaningProgress>({
        current: 0,
        total: 0,
        currentItem: '',
        freedSpace: 0
    })

    // 保存上次清理结果
    const lastCleanupResult = ref<{ freedSpace: number, itemCount: number } | null>(null)

    const diskInfo = ref<DiskInfo>({
        drive: 'C:',
        free: 0,
        used: 0,
        total: 0,
        cleanable: 0
    })
    const folderData = ref<FolderData[]>([])
    const cleanableItems = ref<CleanableItem[]>([])

    function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
        ])
    }

    async function getDiskInfo(): Promise<DiskInfo> {
        if (ipcRenderer) {
            try {
                const info = await withTimeout(
                    ipcRenderer.invoke('get-disk-info', 'C:') as Promise<{ total: number, free: number }>,
                    5000,
                    null as any
                )
                if (info && info.total) {
                    return {
                        drive: 'C:',
                        total: info.total,
                        used: info.total - info.free,
                        free: info.free,
                        cleanable: 0
                    }
                }
            } catch (e) {
                console.error('Failed to get disk info:', e)
            }
        }
        return {
            drive: 'C:',
            total: 200 * 1024 * 1024 * 1024,
            used: 110 * 1024 * 1024 * 1024,
            free: 90 * 1024 * 1024 * 1024,
            cleanable: 0
        }
    }

    async function getDirectorySize(dirPath: string): Promise<number> {
        if (ipcRenderer) {
            try {
                const result = await withTimeout(
                    ipcRenderer.invoke('get-dir-size', dirPath) as Promise<number>,
                    8000,
                    0
                )
                return result || 0
            } catch (e) {
                return 0
            }
        }
        return Math.floor(Math.random() * 500 * 1024 * 1024 + 50 * 1024 * 1024)
    }

    async function scanDirectoryStructure(): Promise<FolderData[]> {
        if (ipcRenderer) {
            try {
                const result = await withTimeout(
                    ipcRenderer.invoke('scan-c-drive') as Promise<FolderData[]>,
                    90000,
                    [] as FolderData[]
                )
                if (result && result.length > 0) {
                    return result
                }
            } catch (e) {
                console.error('Scan error:', e)
            }
        }
        return [
            { name: 'Users', value: 50 * 1024 * 1024 * 1024, path: 'C:\\Users' },
            { name: 'Windows', value: 30 * 1024 * 1024 * 1024, path: 'C:\\Windows' },
            { name: 'Program Files', value: 20 * 1024 * 1024 * 1024, path: 'C:\\Program Files' }
        ]
    }

    async function scanCleanableItems(): Promise<CleanableItem[]> {
        const items: CleanableItem[] = []
        const batchSize = 5

        console.log(`Scanning ${CLEANABLE_RULES.length} cleanable paths...`)

        for (let i = 0; i < CLEANABLE_RULES.length; i += batchSize) {
            const batch = CLEANABLE_RULES.slice(i, i + batchSize)

            const batchPromises = batch.map(async (rule): Promise<CleanableItem | null> => {
                try {
                    const size = await getDirectorySize(rule.path)
                    console.log(`${rule.name}: ${(size / 1024 / 1024).toFixed(1)} MB`)

                    if (size > 1024 * 1024) {
                        const { lang } = useLanguage()
                        return {
                            id: rule.id,
                            name: lang.value === 'zh' ? rule.name : rule.nameEn,
                            path: rule.path,
                            size,
                            description: lang.value === 'zh' ? rule.description : rule.descriptionEn,
                            icon: rule.icon,
                            safe: rule.safe,
                            selected: false
                        }
                    }
                } catch (e) {
                    console.log(`Failed to scan ${rule.path}`)
                }
                return null
            })

            const results = await Promise.all(batchPromises)

            for (const item of results) {
                if (item) items.push(item)
            }

            scanProgress.value = 70 + Math.floor((i / CLEANABLE_RULES.length) * 25)
        }

        items.sort((a, b) => b.size - a.size)
        return items
    }

    async function scan() {
        if (isScanning.value) return

        isScanning.value = true
        scanProgress.value = 0
        console.log('Starting scan...')

        try {
            scanProgress.value = 10
            const info = await getDiskInfo()
            diskInfo.value = info
            scanProgress.value = 30

            scanProgress.value = 40
            folderData.value = await scanDirectoryStructure()
            scanProgress.value = 60

            scanProgress.value = 70
            cleanableItems.value = await scanCleanableItems()

            const totalCleanable = cleanableItems.value.reduce((sum: number, item: CleanableItem) => sum + item.size, 0)
            if (diskInfo.value) {
                diskInfo.value.cleanable = totalCleanable
            }
            console.log(`Total cleanable: ${(totalCleanable / 1024 / 1024 / 1024).toFixed(2)} GB`)

            scanProgress.value = 100
        } catch (error) {
            console.error('Scan error:', error)
        } finally {
            setTimeout(() => {
                isScanning.value = false
            }, 500)
        }
    }

    // 执行清理 - 带进度显示
    async function clean(ids: string[]) {
        if (isCleaning.value || ids.length === 0) return

        // 查找对应的 items
        const itemsToClean = cleanableItems.value.filter(item => ids.includes(item.id))
        if (itemsToClean.length === 0) return

        isCleaning.value = true
        lastCleanupResult.value = null // 重置上次结果

        const cleanedIds: string[] = []
        let freedSpace = 0

        cleaningProgress.value = {
            current: 0,
            total: itemsToClean.length,
            currentItem: '',
            freedSpace: 0
        }

        try {
            for (let i = 0; i < itemsToClean.length; i++) {
                const item = itemsToClean[i]

                // 更新进度
                cleaningProgress.value = {
                    current: i + 1,
                    total: itemsToClean.length,
                    currentItem: item.name,
                    freedSpace
                }

                console.log(`Cleaning: ${item.path}`)

                if (ipcRenderer) {
                    const result = await ipcRenderer.invoke('delete-path', item.path)
                    if (result?.success) {
                        // 使用后端返回的实际释放空间
                        freedSpace += result.freedSpace || item.size
                        cleanedIds.push(item.id)
                    }
                } else {
                    // 模拟清理成功
                    freedSpace += item.size
                    cleanedIds.push(item.id)
                }
            }

            // 使用filter重新赋值确保响应式更新
            cleanableItems.value = cleanableItems.value.filter(
                item => !cleanedIds.includes(item.id)
            )

            // 更新可清理总量
            if (diskInfo.value) {
                diskInfo.value.cleanable = cleanableItems.value.reduce((sum, item) => sum + item.size, 0)
            }

            console.log(`Cleaned! Freed: ${(freedSpace / 1024 / 1024).toFixed(1)} MB`)
            cleaningProgress.value.freedSpace = freedSpace

            // 设置清理结果
            lastCleanupResult.value = {
                freedSpace,
                itemCount: cleanedIds.length
            }

            // 更新磁盘信息
            const newInfo = await getDiskInfo()
            if (diskInfo.value && newInfo) {
                diskInfo.value.free = newInfo.free
                diskInfo.value.used = newInfo.used
            }

        } finally {
            setTimeout(() => {
                isCleaning.value = false
                cleaningProgress.value = { current: 0, total: 0, currentItem: '', freedSpace: 0 }
            }, 1500)
        }
    }

    // 取消扫描
    async function cancelScan() {
        if (ipcRenderer && isScanning.value) {
            try {
                await ipcRenderer.invoke('cancel-scan-c-drive')
                isScanning.value = false
                scanProgress.value = 0
                console.log('Scan cancelled')
            } catch (e) {
                console.error('Cancel scan failed:', e)
            }
        }
    }

    return {
        isScanning,
        isCleaning,
        scanProgress,
        cleaningProgress,
        lastCleanupResult,
        diskInfo,
        folderData,
        cleanableItems,
        scan,
        clean,
        cancelScan
    }
}
