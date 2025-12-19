// 国际化翻译文件
export const translations = {
    zh: {
        // 标题
        appName: 'CleanC',

        // 标签页
        tabClean: '清理',
        tabAnalysis: '大文件分析',
        tabRecovery: '恢复区',

        // 磁盘信息
        diskSpace: '盘空间',
        localDisk: '本地磁盘',
        totalSize: '总容量',
        usedSize: '已使用',
        freeSize: '可用',
        cleanable: '可清理',
        used: '已使用',

        // 扫描
        startScan: '开始扫描',
        scanning: '正在扫描...',
        scanHint: '扫描中，请稍候...',
        scanComplete: '扫描完成！',

        // 清理
        cleanableItems: '可清理项目',
        selectAllSafe: '全选安全项',
        deselectAll: '取消全选',
        noCleanableItems: '暂无可清理项目',
        clickToScan: '点击"开始扫描"检测可清理空间',
        selectedItems: '已选 {count} 项',
        totalSelected: '共 {size}',
        oneClickClean: '一键清理',
        cleaning: '清理中...',
        cleanComplete: '清理完成！',
        freedSpace: '已释放空间：',
        itemsCleaned: '共清理 {count} 个项目',
        safe: '安全',
        caution: '谨慎',

        // 空间分布
        spaceDistribution: '空间分布',
        clickToViewSpace: '点击"开始扫描"查看空间分布',
        folders: '个目录',
        openFolder: '打开文件夹',
        goBack: '返回上层',
        seconds: '秒',

        // TOP排行
        topUsage: 'TOP 占用排行',

        // 恢复区
        recoveryZone: '恢复区',
        recoveryHint: '已清理的文件会暂存在这里，您可以恢复或永久删除',
        restore: '恢复',
        permanentDelete: '永久删除',
        emptyRecovery: '恢复区为空',
        emptyRecoveryHint: '已清理的文件会显示在这里',
        totalItems: '共 {count} 项',
        totalUsage: '占用 {size}',
        clearRecovery: '清空恢复区（永久删除全部）',
        cleanedAt: '清理于:',

        // 大文件分析
        largeFileAnalysis: '大文件分析',
        largeFileHint: '扫描 C 盘中超过 100MB 的大文件，智能分析是否可删除',
        startAnalysis: '开始分析',
        analyzing: '扫描中...',
        cancelScan: '取消扫描',
        scanWarning: '扫描中，请勿关闭应用。如需取消请点击"取消扫描"按钮。',
        excludeDirSettings: '排除目录设置',
        excludeDirHint: '排除目录（这些目录不会被扫描）',
        addDirectory: '添加目录',
        analysisResults: '分析结果',
        foundItems: '找到 {count} 个大文件/文件夹',
        totalResultSize: '总计 {size}',
        timeTaken: '用时 {time} 秒',
        all: '全部',
        safeToDelete: '安全删除',
        cautionDelete: '谨慎删除',
        dangerDelete: '不建议删除',
        selectAll: '全选当前列表',
        items: '项',
        deleteSelected: '删除选中项',

        // 管理员
        adminMode: '管理员',
        elevatePrivilege: '提升权限',

        // 确认对话框
        confirmClean: '确定要清理选中的 {count} 个项目吗？\n预计释放: {size}\n\n⚠️ 注意：临时文件和缓存将被直接删除，无法恢复。',
        confirmRestore: '确定要恢复 "{name}" 吗？\n\n文件将恢复到: {path}',
        confirmPermanentDelete: '⚠️ 警告：永久删除后无法恢复！\n\n确定要永久删除 "{name}" 吗？',
        confirmClearRecovery: '⚠️ 警告：此操作将永久删除恢复区中的所有 {count} 个项目！\n\n删除后无法恢复，确定继续吗？',
        confirmAdminRestart: '需要以管理员身份重新启动应用，才能清理系统文件。\n\n是否立即重启？',

        // 结果消息
        restoreSuccess: '恢复成功！已恢复 {size}',
        restoreFailed: '恢复失败: ',
        deleteSuccess: '已永久删除，释放 {size}',
        deleteFailed: '删除失败: ',
        recoveryClear: '恢复区已清空',
        scanCancelled: '扫描已取消',
        scanFailed: '扫描失败',
    },

    en: {
        // Title
        appName: 'CleanC',

        // Tabs
        tabClean: 'Clean',
        tabAnalysis: 'Large Files',
        tabRecovery: 'Recovery',

        // Disk info
        diskSpace: 'Drive Space',
        localDisk: 'Local Disk',
        totalSize: 'Total',
        usedSize: 'Used',
        freeSize: 'Free',
        cleanable: 'Cleanable',
        used: 'used',

        // Scan
        startScan: 'Start Scan',
        scanning: 'Scanning...',
        scanHint: 'Scanning, please wait...',
        scanComplete: 'Scan complete!',

        // Clean
        cleanableItems: 'Cleanable Items',
        selectAllSafe: 'Select Safe',
        deselectAll: 'Deselect All',
        noCleanableItems: 'No cleanable items',
        clickToScan: 'Click "Start Scan" to detect cleanable space',
        selectedItems: '{count} selected',
        totalSelected: 'Total {size}',
        oneClickClean: 'Clean All',
        cleaning: 'Cleaning...',
        cleanComplete: 'Clean complete!',
        freedSpace: 'Freed space: ',
        itemsCleaned: '{count} items cleaned',
        safe: 'Safe',
        caution: 'Caution',

        // Space distribution
        spaceDistribution: 'Space Distribution',
        clickToViewSpace: 'Click "Start Scan" to view space distribution',
        folders: 'folders',
        openFolder: 'Open Folder',
        goBack: 'Back',
        seconds: 's',

        // TOP ranking
        topUsage: 'TOP Usage Ranking',

        // Recovery zone
        recoveryZone: 'Recovery Zone',
        recoveryHint: 'Cleaned files are stored here, you can restore or permanently delete',
        restore: 'Restore',
        permanentDelete: 'Delete',
        emptyRecovery: 'Recovery is empty',
        emptyRecoveryHint: 'Cleaned files will appear here',
        totalItems: '{count} items',
        totalUsage: 'Using {size}',
        clearRecovery: 'Clear Recovery (Delete All)',
        cleanedAt: 'Cleaned at:',

        // Large file analysis
        largeFileAnalysis: 'Large File Analysis',
        largeFileHint: 'Scan C drive for files over 100MB, analyze if deletable',
        startAnalysis: 'Start Analysis',
        analyzing: 'Scanning...',
        cancelScan: 'Cancel',
        scanWarning: 'Scanning, do not close. Click "Cancel" to stop.',
        excludeDirSettings: 'Exclude Directories',
        excludeDirHint: 'These directories will not be scanned',
        addDirectory: 'Add Directory',
        analysisResults: 'Results',
        foundItems: 'Found {count} large files/folders',
        totalResultSize: 'Total {size}',
        timeTaken: 'Took {time}s',
        all: 'All',
        safeToDelete: 'Safe',
        cautionDelete: 'Caution',
        dangerDelete: 'Danger',
        selectAll: 'Select all',
        items: 'items',
        deleteSelected: 'Delete Selected',

        // Admin
        adminMode: 'Admin',
        elevatePrivilege: 'Elevate',

        // Confirm dialogs
        confirmClean: 'Clean {count} selected items?\nEstimated: {size}\n\n⚠️ Note: Temp files and cache will be permanently deleted.',
        confirmRestore: 'Restore "{name}"?\n\nFile will be restored to: {path}',
        confirmPermanentDelete: '⚠️ Warning: Cannot be undone!\n\nPermanently delete "{name}"?',
        confirmClearRecovery: '⚠️ Warning: This will permanently delete all {count} items in recovery!\n\nContinue?',
        confirmAdminRestart: 'Admin privileges required to clean system files.\n\nRestart as admin?',

        // Result messages
        restoreSuccess: 'Restored {size}',
        restoreFailed: 'Restore failed: ',
        deleteSuccess: 'Deleted, freed {size}',
        deleteFailed: 'Delete failed: ',
        recoveryClear: 'Recovery cleared',
        scanCancelled: 'Scan cancelled',
        scanFailed: 'Scan failed',
    }
}

export type Language = 'zh' | 'en'
export type TranslationKey = keyof typeof translations.zh
