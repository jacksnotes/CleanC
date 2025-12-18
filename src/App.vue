<template>
  <div class="app">
    <!-- 头部 -->
    <header class="header">
      <div class="logo" @click="showAboutModal = true" style="cursor: pointer;" :title="lang === 'zh' ? '关于 CleanC' : 'About CleanC'">
        <img src="/logo.png" alt="CleanC" class="logo-icon" />
        <h1>CleanC</h1>
      </div>
      <div class="header-actions">
        <button 
          class="btn" 
          :class="{ active: activeTab === 'main' }"
          @click="activeTab = 'main'"
        >
          <span class="icon">🧹</span>
          {{ t.tabClean }}
        </button>
        <button 
          class="btn" 
          :class="{ active: activeTab === 'analysis' }"
          @click="activeTab = 'analysis'"
        >
          <span class="icon">🔍</span>
          {{ t.tabAnalysis }}
        </button>
        <button 
          class="btn" 
          :class="{ active: activeTab === 'recovery' }"
          @click="activeTab = 'recovery'; loadRecoveryItems()"
        >
          <span class="icon">🗄️</span>
          {{ t.tabRecovery }}
          <span class="recovery-badge" v-if="recoveryItems.length">{{ recoveryItems.length }}</span>
        </button>
        
        <!-- 语言切换 -->
        <button class="btn btn-sm lang-toggle" @click="toggleLanguage">
          {{ lang === 'zh' ? 'EN' : '中' }}
        </button>
        
        <div class="admin-status" :class="isAdminMode ? 'admin' : 'not-admin'">
          <span v-if="isAdminMode">🛡️ {{ t.adminMode }}</span>
          <button v-else class="btn btn-sm btn-warning" @click="requestAdminRestart">
            ⚠️ {{ t.elevatePrivilege }}
          </button>
        </div>
      </div>
    </header>

    <!-- 主内容区 - 清理页面 -->
    <main class="main" v-if="activeTab === 'main'">
      <!-- 左侧面板：磁盘信息 + Treemap -->
      <section class="panel-left">
        <!-- 磁盘概览卡片 -->
        <div class="disk-overview card">
          <div class="disk-header">
            <div class="disk-icon">💾</div>
            <div class="disk-info">
              <h2>C: {{ t.diskSpace }}</h2>
              <p class="disk-path">{{ t.localDisk }}</p>
            </div>
          </div>
          
          <div class="disk-stats">
            <div class="stat-item">
              <span class="stat-label">{{ t.totalSize }}</span>
              <span class="stat-value">{{ formatSize(diskInfo.total) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t.usedSize }}</span>
              <span class="stat-value used">{{ formatSize(diskInfo.used) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t.freeSize }}</span>
              <span class="stat-value free">{{ formatSize(diskInfo.free) }}</span>
            </div>
            <div class="stat-item highlight" v-if="diskInfo.cleanable > 0">
              <span class="stat-label">{{ t.cleanable }}</span>
              <span class="stat-value cleanable">{{ formatSize(diskInfo.cleanable) }}</span>
            </div>
          </div>

          <!-- 使用进度条 -->
          <div class="disk-bar">
            <div class="disk-bar-used" :style="{ width: usagePercent + '%' }"></div>
            <div class="disk-bar-cleanable" v-if="diskInfo.cleanable > 0" 
                 :style="{ width: cleanablePercent + '%', left: (usagePercent - cleanablePercent) + '%' }"></div>
          </div>
          <div class="disk-bar-legend">
            <span>{{ usagePercent.toFixed(1) }}% {{ t.used }}</span>
            <span v-if="diskInfo.cleanable > 0" class="cleanable-hint">
              {{ lang === 'zh' ? '可释放' : 'Can free' }} {{ cleanablePercent.toFixed(1) }}%
            </span>
          </div>
        </div>

        <!-- Treemap 可视化 -->
        <div class="treemap-container card">
          <div class="card-header">
            <h3>📊 {{ t.spaceDistribution }}</h3>
            <div class="treemap-actions">
              <span class="badge" v-if="folderData.length">{{ folderData.length }} {{ t.folders }}</span>
              <button class="btn btn-sm" v-if="selectedFolder" @click="selectedFolder = null">
                返回上层
              </button>
            </div>
          </div>
          <div class="treemap-content">
            <v-chart 
              ref="chartRef"
              v-if="treemapOption" 
              :option="treemapOption" 
              autoresize 
              @click="handleTreemapClick"
            />
            <div v-else class="treemap-empty">
              <span class="empty-icon">📁</span>
              <p>{{ t.clickToViewSpace }}</p>
            </div>
          </div>
          <!-- 选中文件夹详情 -->
          <div class="folder-detail" v-if="selectedFolder" :key="selectedFolder.path">
            <div class="folder-detail-header">
              <span class="folder-icon">📂</span>
              <div class="folder-info">
                <strong>{{ selectedFolder.name }}</strong>
                <span class="folder-path">{{ selectedFolder.path }}</span>
              </div>
              <span class="folder-size">{{ formatSize(selectedFolder.value) }}</span>
            </div>
            <button class="btn btn-sm" @click="openFolder(selectedFolder.path)">
              <span class="icon">📁</span> {{ t.openFolder }}
            </button>
          </div>
        </div>
      </section>

      <!-- 右侧面板：清理项目列表 -->
      <section class="panel-right">
        <!-- 扫描控制 -->
        <div class="scan-control card">
          <button class="btn btn-primary btn-large" @click="startScan" :disabled="isScanning">
            <span v-if="isScanning" class="spinner"></span>
            <span v-else class="icon">🔍</span>
            {{ isScanning ? t.scanning : t.startScan }}
          </button>
          
          <!-- 扫描进度 -->
          <div class="scan-progress" v-if="isScanning">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: scanProgress + '%' }"></div>
            </div>
            <span class="progress-text">{{ scanProgress }}%</span>
          </div>
          <p class="scan-hint" v-if="isScanning">{{ t.scanHint }}</p>
        </div>

        <!-- 清理结果提示 -->
        <div class="cleanup-result card" v-if="lastCleanupResult">
          <div class="result-icon">✅</div>
          <div class="result-info">
            <h4>{{ t.cleanComplete }}</h4>
            <p>{{ t.freedSpace }}<strong>{{ formatSize(lastCleanupResult.freedSpace) }}</strong></p>
            <p class="result-detail">{{ t.itemsCleaned.replace('{count}', String(lastCleanupResult.itemCount)) }}</p>
          </div>
          <button class="btn btn-ghost btn-sm" @click="lastCleanupResult = null">{{ lang === 'zh' ? '关闭' : 'Close' }}</button>
        </div>

        <!-- 可清理项目列表 -->
        <div class="cleanable-list card">
          <div class="card-header">
            <h3>🧹 {{ t.cleanableItems }}</h3>
            <div class="header-actions">
              <button class="btn btn-sm" @click="selectAllSafe" :disabled="cleanableItems.length === 0">
                {{ t.selectAllSafe }}
              </button>
              <button class="btn btn-sm" @click="deselectAll" :disabled="cleanableItems.length === 0">
                {{ t.deselectAll }}
              </button>
            </div>
          </div>

          <div class="cleanable-items" v-if="cleanableItems.length > 0">
            <div 
              v-for="item in cleanableItems" 
              :key="item.id"
              class="cleanable-item"
              :class="{ selected: item.selected, unsafe: !item.safe }"
              @click="item.selected = !item.selected"
            >
              <label class="item-checkbox" @click.stop>
                <input type="checkbox" v-model="item.selected" />
                <span class="checkmark"></span>
              </label>
              <div class="item-icon">{{ item.icon }}</div>
              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-desc">{{ item.description }}</span>
              </div>
              <div class="item-size">{{ formatSize(item.size) }}</div>
              <span class="item-badge safe" v-if="item.safe">{{ t.safe }}</span>
              <span class="item-badge unsafe" v-else>{{ t.caution }}</span>
            </div>
          </div>

          <div class="empty-state" v-else-if="!isScanning">
            <span class="empty-icon">📭</span>
            <p>{{ t.noCleanableItems }}</p>
            <p class="empty-hint">{{ t.clickToScan }}</p>
          </div>

          <!-- 清理操作栏 -->
          <div class="clean-action-bar" v-if="selectedItems.length > 0">
            <div class="selected-info">
              <span>{{ lang === 'zh' ? '已选' : 'Selected:' }} {{ selectedItems.length }} {{ lang === 'zh' ? '项' : 'items' }}</span>
              <span class="selected-size">{{ lang === 'zh' ? '共' : 'Total:' }} {{ formatSize(selectedTotalSize) }}</span>
            </div>
            <button 
              class="btn btn-danger btn-large" 
              @click="performClean"
              :disabled="isCleaning"
            >
              <span v-if="isCleaning" class="spinner"></span>
              <span v-else class="icon">🗑️</span>
              {{ isCleaning ? t.cleaning : t.oneClickClean }}
            </button>
          </div>
        </div>

        <!-- TOP 占用排行 -->
        <div class="top-folders card" v-if="topFolders.length > 0">
          <div class="card-header">
            <h3>📈 {{ t.topUsage }}</h3>
          </div>
          <div class="top-list">
            <div 
              v-for="(folder, index) in topFolders.slice(0, 10)" 
              :key="folder.path" 
              class="top-item"
              @click="openFolder(folder.path)"
            >
              <span class="top-rank">{{ index + 1 }}</span>
              <div class="top-info">
                <span class="top-name">{{ folder.name }}</span>
                <span class="top-path">{{ folder.path }}</span>
              </div>
              <span class="top-size">{{ formatSize(folder.value) }}</span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 恢复区页面 -->
    <main class="main recovery-main" v-else-if="activeTab === 'recovery'">
      <div class="recovery-container">
        <div class="card recovery-card">
          <div class="card-header">
            <h3>🗄️ {{ t.recoveryZone }}</h3>
            <p class="recovery-hint">{{ t.recoveryHint }}</p>
          </div>

          <div class="recovery-items" v-if="recoveryItems.length > 0">
            <div 
              v-for="item in recoveryItems" 
              :key="item.id"
              class="recovery-item"
            >
              <div class="recovery-item-icon">🗂️</div>
              <div class="recovery-item-info">
                <span class="recovery-item-name">{{ getRecoveryItemName(item.originalPath) }}</span>
                <span class="recovery-item-path">{{ item.originalPath }}</span>
                <span class="recovery-item-date">{{ t.cleanedAt }} {{ formatDate(item.movedAt) }}</span>
              </div>
              <div class="recovery-item-size">{{ formatSize(item.size) }}</div>
              <div class="recovery-item-actions">
                <button class="btn btn-sm btn-success" @click="restoreItem(item)" :disabled="isRestoring">
                  <span class="icon">↩️</span> {{ t.restore }}
                </button>
                <button class="btn btn-sm btn-danger" @click="permanentDelete(item)" :disabled="isRestoring">
                  <span class="icon">🗑️</span> {{ t.permanentDelete }}
                </button>
              </div>
            </div>
          </div>

          <div class="empty-state" v-else>
            <span class="empty-icon">📭</span>
            <p>{{ t.emptyRecovery }}</p>
            <p class="empty-hint">{{ t.emptyRecoveryHint }}</p>
          </div>

          <!-- 批量操作 -->
          <div class="recovery-actions" v-if="recoveryItems.length > 0">
            <div class="recovery-stats">
              <span>{{ t.totalItems.replace('{count}', String(recoveryItems.length)) }}</span>
              <span class="recovery-total-size">{{ t.totalUsage.replace('{size}', formatSize(recoveryTotalSize)) }}</span>
            </div>
            <button class="btn btn-danger" @click="clearAllRecovery" :disabled="isRestoring">
              {{ t.clearRecovery }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- 大文件分析页面 -->
    <main class="main analysis-main" v-if="activeTab === 'analysis'">
      <div class="analysis-container">
        <!-- 控制面板 -->
        <div class="analysis-controls card">
          <div class="analysis-header">
            <h3>🔍 {{ t.largeFileAnalysis }}</h3>
            <p class="analysis-desc">{{ t.largeFileHint }}</p>
          </div>
          
          <div class="analysis-actions">
            <button 
              class="btn btn-primary btn-large" 
              @click="startLargeFileScan"
              :disabled="isAnalyzing"
            >
              <span v-if="isAnalyzing" class="spinner"></span>
              <span v-else class="icon">🔎</span>
              {{ isAnalyzing ? t.analyzing : t.startAnalysis }}
            </button>
            
            <button 
              v-if="isAnalyzing"
              class="btn btn-warning btn-large"
              @click="cancelScan"
            >
              ✕ {{ t.cancelScan }}
            </button>
            
            <div class="scan-settings" v-if="!isAnalyzing">
              <label>
                <input type="checkbox" v-model="showExcludeSettings" />
                {{ t.excludeDirSettings }}
              </label>
            </div>
          </div>
          
          <!-- 扫描提示 -->
          <div class="scan-warning" v-if="isAnalyzing">
            ⚠️ {{ t.scanWarning }}
          </div>
          
          <!-- 排除目录设置 -->
          <div class="exclude-settings" v-if="showExcludeSettings">
            <h4>{{ t.excludeDirHint }}</h4>
            <div class="exclude-list">
              <div v-for="(_, index) in excludeDirs" :key="index" class="exclude-item">
                <input type="text" v-model="excludeDirs[index]" :placeholder="lang === 'zh' ? '输入目录路径' : 'Enter directory path'" />
                <button class="btn btn-sm btn-ghost" @click="excludeDirs.splice(index, 1)">✕</button>
              </div>
              <button class="btn btn-sm" @click="excludeDirs.push('')">+ {{ t.addDirectory }}</button>
            </div>
          </div>

          <!-- 扫描进度 -->
          <div class="analysis-progress" v-if="isAnalyzing || analysisStatus">
            <div class="progress-bar large" v-if="isAnalyzing">
              <div class="progress-fill" :style="{ width: analysisProgress + '%' }"></div>
            </div>
            <div class="progress-details">
              <p class="progress-text">{{ analysisStatus }}</p>
              <p class="progress-path" v-if="currentScanPath && isAnalyzing">📂 {{ currentScanPath }}</p>
              <span class="elapsed-time" v-if="scanDuration > 0">⏱️ {{ scanDuration }}秒</span>
            </div>
          </div>
        </div>

        <!-- 分析结果 -->
        <div class="analysis-results card" v-if="largeFiles.length > 0">
          <div class="card-header">
            <h3>📊 {{ t.analysisResults }}</h3>
            <div class="result-stats">
              <span>{{ t.foundItems.replace('{count}', String(largeFiles.length)) }}</span>
              <span class="total-size">{{ t.totalResultSize.replace('{size}', formatSize(largeFilesTotalSize)) }}</span>
              <span class="scan-duration" v-if="scanDuration > 0">{{ t.timeTaken.replace('{time}', String(scanDuration)) }}</span>
            </div>
          </div>

          <!-- 筛选器 -->
          <div class="filter-bar">
            <div class="filter-buttons">
              <button 
                class="btn btn-sm" 
                :class="{ active: analysisFilter === 'all' }"
                @click="analysisFilter = 'all'"
              >{{ t.all }}</button>
              <button 
                class="btn btn-sm" 
                :class="{ active: analysisFilter === 'safe' }"
                @click="analysisFilter = 'safe'"
              >🟢 {{ t.safeToDelete }}</button>
              <button 
                class="btn btn-sm" 
                :class="{ active: analysisFilter === 'caution' }"
                @click="analysisFilter = 'caution'"
              >🟡 {{ t.cautionDelete }}</button>
              <button 
                class="btn btn-sm" 
                :class="{ active: analysisFilter === 'danger' }"
                @click="analysisFilter = 'danger'"
              >🔴 {{ t.dangerDelete }}</button>
            </div>
            <label class="select-all-checkbox">
              <input 
                type="checkbox" 
                :checked="allFilteredSelected" 
                @change="toggleSelectAll"
              />
              <span>{{ t.selectAll }} ({{ filteredLargeFiles.length }} {{ t.items }})</span>
            </label>
          </div>

          <!-- 大文件列表 -->
          <div class="large-file-list">
            <div 
              v-for="file in filteredLargeFiles" 
              :key="file.path"
              class="large-file-item"
              :class="[file.recommendation.level, { selected: file.selected }]"
              @click="file.selected = !file.selected"
            >
              <label class="item-checkbox" @click.stop>
                <input type="checkbox" v-model="file.selected" />
                <span class="checkmark"></span>
              </label>
              <span class="file-icon">{{ file.isDirectory ? '📁' : '📄' }}</span>
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-path">{{ file.path }}</span>
              </div>
              <span class="file-size">{{ formatSize(file.size) }}</span>
              <span 
                class="recommendation-badge"
                :style="{ backgroundColor: file.recommendation.color }"
              >
                {{ lang === 'zh' ? file.recommendation.label : (file.recommendation.labelEn || file.recommendation.label) }}
              </span>
              <button class="btn btn-sm btn-ghost" @click.stop="openFolder(getParentDir(file.path))">
                📂
              </button>
            </div>
          </div>

          <!-- 操作栏 -->
          <div class="analysis-action-bar" v-if="selectedLargeFiles.length > 0">
            <div class="selected-info">
              <span>{{ lang === 'zh' ? '已选' : 'Selected:' }} {{ selectedLargeFiles.length }} {{ lang === 'zh' ? '项' : 'items' }}</span>
              <span class="selected-size">{{ lang === 'zh' ? '共' : 'Total:' }} {{ formatSize(selectedLargeFilesSize) }}</span>
            </div>
            <button 
              class="btn btn-danger btn-large" 
              @click="deleteSelectedLargeFiles"
              :disabled="isDeletingLargeFiles"
            >
              <span v-if="isDeletingLargeFiles" class="spinner"></span>
              <span v-else class="icon">🗑️</span>
              {{ isDeletingLargeFiles ? (lang === 'zh' ? '删除中...' : 'Deleting...') : t.deleteSelected }}
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div class="analysis-empty card" v-else-if="!isAnalyzing && hasScannedOnce">
            <span class="empty-icon">✨</span>
            <p>{{ lang === 'zh' ? '没有找到超过 100MB 的大文件' : 'No files over 100MB found' }}</p>
            <p class="empty-hint">{{ lang === 'zh' ? '您的 C 盘已经很干净了！' : 'Your C drive is already clean!' }}</p>
        </div>
      </div>
    </main>

    <!-- 清理进度弹窗 -->
    <div class="modal-overlay" v-if="isCleaning">
      <div class="modal cleaning-modal">
        <div class="modal-header">
          <h3>🧹 {{ lang === 'zh' ? '正在清理...' : 'Cleaning...' }}</h3>
        </div>
        <div class="modal-body">
          <div class="cleaning-progress">
            <div class="progress-bar large">
              <div class="progress-fill" :style="{ width: cleaningProgressPercent + '%' }"></div>
            </div>
            <div class="progress-info">
              <span>{{ cleaningProgress.current }} / {{ cleaningProgress.total }}</span>
              <span class="current-item">{{ cleaningProgress.currentItem }}</span>
            </div>
          </div>
          <div class="freed-space" v-if="cleaningProgress.freedSpace > 0">
            {{ lang === 'zh' ? '已处理:' : 'Processed:' }} <strong>{{ formatSize(cleaningProgress.freedSpace) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- About 弹窗 -->
    <div class="modal-overlay" v-if="showAboutModal" @click.self="showAboutModal = false">
      <div class="modal about-modal">
        <div class="modal-header">
          <h3>{{ lang === 'zh' ? '关于' : 'About' }}</h3>
          <button class="modal-close" @click="showAboutModal = false">✕</button>
        </div>
        <div class="modal-body about-content">
          <img src="/logo.png" alt="CleanC" class="about-logo" />
          <h2>CleanC</h2>
          <p class="version">Version 1.0.0</p>
          <p class="description">{{ lang === 'zh' ? '智能C盘空间管理工具' : 'Smart C Drive Space Manager' }}</p>
          <div class="about-links">
            <a href="https://github.com/jacksnotes/CleanC" target="_blank">GitHub</a>
            <a href="https://cdriveclean.com" target="_blank">{{ lang === 'zh' ? '官网' : 'Website' }}</a>
          </div>
          <p class="copyright">© 2025 CleanC</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { TreemapChart } from 'echarts/charts'
import { TooltipComponent, TitleComponent } from 'echarts/components'
import { useDiskScanner, type FolderData } from './composables/useDiskScanner'
import { useLanguage } from './composables/useLanguage'

// 注册 ECharts 组件
use([CanvasRenderer, TreemapChart, TooltipComponent, TitleComponent])

// 语言
const { lang, t, toggleLanguage } = useLanguage()

// Electron IPC
const isElectron = typeof window !== 'undefined' && typeof (window as any).require === 'function'
let ipcRenderer: any = null
if (isElectron) {
  try {
    const { ipcRenderer: ipc } = (window as any).require('electron')
    ipcRenderer = ipc
  } catch (e) {}
}

const {
  isScanning,
  isCleaning,
  scanProgress,
  cleaningProgress,
  lastCleanupResult,
  diskInfo,
  folderData,
  cleanableItems,
  scan,
  clean
} = useDiskScanner()

// UI 状态
const activeTab = ref<'main' | 'recovery' | 'analysis'>('main')

const chartRef = ref<any>()
const selectedFolder = ref<FolderData | null>(null)
const isRestoring = ref(false)
const showAboutModal = ref(false)

// 管理员状态
const isAdminMode = ref(false)

// 大文件分析状态
interface LargeFile {
  path: string
  name: string
  size: number
  isDirectory: boolean
  modifiedTime: string
  recommendation: {
    level: string
    label: string
    labelEn?: string
    color: string
    description: string
    descriptionEn?: string
  }
  selected?: boolean
}

const isAnalyzing = ref(false)
const analysisProgress = ref(0)
const analysisStatus = ref('')
const largeFiles = ref<LargeFile[]>([])
const analysisFilter = ref<'all' | 'safe' | 'caution' | 'danger'>('all')
const excludeDirs = ref<string[]>([
  'C:\\Program Files\\Steam',
  'C:\\Games',
  'C:\\Program Files\\NVIDIA Corporation',
  'C:\\Program Files\\AMD',
  'C:\\Program Files\\Intel',
  'C:\\Program Files\\Realtek',
  'C:\\Windows\\System32',
  'C:\\Windows\\SysWOW64',
  'C:\\Windows\\WinSxS',
])
const showExcludeSettings = ref(false)
const hasScannedOnce = ref(false)
const isDeletingLargeFiles = ref(false)

// 计算属性
const largeFilesTotalSize = computed(() => 
  largeFiles.value.reduce((sum, f) => sum + f.size, 0)
)

const filteredLargeFiles = computed(() => {
  if (analysisFilter.value === 'all') return largeFiles.value
  return largeFiles.value.filter(f => f.recommendation.level === analysisFilter.value)
})

const selectedLargeFiles = computed(() => 
  largeFiles.value.filter(f => f.selected)
)

const selectedLargeFilesSize = computed(() => 
  selectedLargeFiles.value.reduce((sum, f) => sum + f.size, 0)
)

// 检查当前筛选列表是否全选
const allFilteredSelected = computed(() => {
  const filtered = filteredLargeFiles.value
  if (filtered.length === 0) return false
  return filtered.every(f => f.selected)
})

// 全选/取消全选当前筛选列表
function toggleSelectAll() {
  const filtered = filteredLargeFiles.value
  const shouldSelect = !allFilteredSelected.value
  filtered.forEach(f => { f.selected = shouldSelect })
}

// 获取管理员状态
async function checkAdminStatus() {
  if (ipcRenderer) {
    isAdminMode.value = await ipcRenderer.invoke('get-admin-status')
  }
}

// 请求管理员重启
async function requestAdminRestart() {
  if (ipcRenderer) {
    const msg = lang.value === 'zh' 
      ? '需要以管理员身份重新启动应用，才能清理系统文件。\n\n是否立即重启？'
      : 'Admin privileges required to clean system files.\n\nRestart as admin?'
    if (confirm(msg)) {
      await ipcRenderer.invoke('request-admin-restart')
    }
  }
}

// 扫描用时
const scanDuration = ref(0)
const currentScanPath = ref('')

// 开始大文件扫描
async function startLargeFileScan() {
  if (!ipcRenderer || isAnalyzing.value) return
  
  isAnalyzing.value = true
  analysisProgress.value = 0
  analysisStatus.value = lang.value === 'zh' ? '正在初始化...' : 'Initializing...'
  currentScanPath.value = ''
  scanDuration.value = 0
  largeFiles.value = []
  
  // 监听进度事件
  const progressHandler = (_event: any, data: any) => {
    analysisProgress.value = Math.min(90, Math.floor(data.found / 2)) // 基于找到的文件数量估算进度
    scanDuration.value = data.elapsedTime || 0
    currentScanPath.value = data.currentPath || ''
    analysisStatus.value = lang.value === 'zh' 
      ? `已扫描 ${data.scanned.toLocaleString()} 项，发现 ${data.found} 个大文件`
      : `Scanned ${data.scanned.toLocaleString()} items, found ${data.found} large files`
  }
  
  ipcRenderer.on('scan-progress', progressHandler)
  
  try {
    const result = await ipcRenderer.invoke('scan-large-files', {
      minSize: 100 * 1024 * 1024, // 100MB
      excludeDirs: excludeDirs.value.filter(d => d.trim()),
      maxResults: 200
    })
    
    if (result.success) {
      largeFiles.value = result.results.map((f: LargeFile) => ({ ...f, selected: false }))
      hasScannedOnce.value = true
      scanDuration.value = result.duration || 0
      analysisStatus.value = lang.value === 'zh' 
        ? `扫描完成！用时 ${result.duration} 秒，找到 ${result.results.length} 项`
        : `Scan complete! Took ${result.duration}s, found ${result.results.length} items`
    } else if (result.cancelled) {
      analysisStatus.value = lang.value === 'zh' ? '扫描已取消' : 'Scan cancelled'
    }
  } catch (e) {
    console.error('Scan failed:', e)
    analysisStatus.value = lang.value === 'zh' ? '扫描失败' : 'Scan failed'
  } finally {
    ipcRenderer.off('scan-progress', progressHandler)
    isAnalyzing.value = false
    analysisProgress.value = 100
  }
}

// 取消扫描
async function cancelScan() {
  if (!ipcRenderer || !isAnalyzing.value) return
  
  analysisStatus.value = lang.value === 'zh' ? '正在取消...' : 'Cancelling...'
  await ipcRenderer.invoke('cancel-scan')
}

// 删除选中的大文件
async function deleteSelectedLargeFiles() {
  if (!ipcRenderer || isDeletingLargeFiles.value) return
  
  const selected = selectedLargeFiles.value
  if (selected.length === 0) return
  
  // 分类统计
  const dangerItems = selected.filter(f => f.recommendation.level === 'danger')
  const cautionItems = selected.filter(f => f.recommendation.level === 'caution' || f.recommendation.level === 'unknown')
  const safeItems = selected.filter(f => f.recommendation.level === 'safe')
  
  // 构建确认消息
  let confirmMsg = ''
  if (lang.value === 'zh') {
    confirmMsg = `确定要处理选中的 ${selected.length} 项吗？\n\n`
    confirmMsg += `预计释放空间: ${formatSize(selectedLargeFilesSize.value)}\n\n`
    if (safeItems.length > 0) {
      confirmMsg += `🟢 ${safeItems.length} 项将直接删除\n`
    }
    if (cautionItems.length > 0) {
      confirmMsg += `🟡 ${cautionItems.length} 项将移至恢复区（可恢复）\n`
    }
    if (dangerItems.length > 0) {
      confirmMsg += `\n⚠️ 严重警告 ⚠️\n`
      confirmMsg += `包含 ${dangerItems.length} 个不建议删除的系统文件！\n`
      confirmMsg += `删除后可能导致：\n`
      confirmMsg += `• 显卡/声卡驱动失效\n`
      confirmMsg += `• 应用程序无法运行\n`
      confirmMsg += `• 系统蓝屏或崩溃\n\n`
      confirmMsg += `确定要继续吗？`
    }
  } else {
    confirmMsg = `Delete ${selected.length} selected items?\n\n`
    confirmMsg += `Estimated space: ${formatSize(selectedLargeFilesSize.value)}\n\n`
    if (safeItems.length > 0) {
      confirmMsg += `🟢 ${safeItems.length} items will be deleted\n`
    }
    if (cautionItems.length > 0) {
      confirmMsg += `🟡 ${cautionItems.length} items will be moved to recovery\n`
    }
    if (dangerItems.length > 0) {
      confirmMsg += `\n⚠️ SEVERE WARNING ⚠️\n`
      confirmMsg += `Contains ${dangerItems.length} system files!\n`
      confirmMsg += `Deletion may cause:\n`
      confirmMsg += `• Driver failures\n`
      confirmMsg += `• App crashes\n`
      confirmMsg += `• System instability\n\n`
      confirmMsg += `Continue?`
    }
  }
  
  if (!confirm(confirmMsg)) return
  
  // 危险文件二次确认
  if (dangerItems.length > 0) {
    const secondMsg = lang.value === 'zh'
      ? `⚠️ 最后确认 ⚠️\n\n您即将删除 ${dangerItems.length} 个系统/程序文件。\n此操作不可逆，可能导致系统损坏！\n\n确定继续吗？`
      : `⚠️ FINAL CONFIRMATION ⚠️\n\nYou are about to delete ${dangerItems.length} system files.\nThis cannot be undone and may damage your system!\n\nContinue?`
    const secondConfirm = confirm(secondMsg)
    if (!secondConfirm) return
  }
  
  isDeletingLargeFiles.value = true
  let freedTotal = 0
  let successCount = 0
  let failCount = 0
  let recoveryCount = 0
  const messages: string[] = []
  
  for (const file of selected) {
    try {
      let result
      
      // 根据级别选择不同处理方式
      if (file.recommendation.level === 'caution' || file.recommendation.level === 'unknown') {
        // 谨慎删除项 → 移至恢复区
        result = await ipcRenderer.invoke('move-to-recovery-zone', file.path, file.isDirectory)
        if (result.success) {
          recoveryCount++
          freedTotal += result.freedSpace || 0
          // 从列表中移除
          const index = largeFiles.value.findIndex(f => f.path === file.path)
          if (index > -1) largeFiles.value.splice(index, 1)
        } else {
          failCount++
          messages.push(`${file.name}: ${result.error || '移动失败'}`)
        }
      } else {
        // 安全删除/危险删除 → 直接删除
        result = await ipcRenderer.invoke('delete-large-file', file.path, file.isDirectory)
        if (result.success) {
          freedTotal += result.freedSpace || 0
          successCount++
          if (result.deleted) {
            const index = largeFiles.value.findIndex(f => f.path === file.path)
            if (index > -1) largeFiles.value.splice(index, 1)
          } else {
            messages.push(`${file.name}: ${result.message}`)
          }
        } else {
          failCount++
          messages.push(`${file.name}: ${result.error || '删除失败'}`)
        }
      }
    } catch (e) {
      failCount++
      console.error(`Failed to process ${file.path}:`, e)
    }
  }
  
  isDeletingLargeFiles.value = false
  
  // 显示结果
  let resultMsg = ''
  if (lang.value === 'zh') {
    resultMsg = `处理完成！\n\n`
    if (successCount > 0) resultMsg += `✅ 直接删除: ${successCount} 项\n`
    if (recoveryCount > 0) resultMsg += `📦 移至恢复区: ${recoveryCount} 项\n`
    if (failCount > 0) resultMsg += `❌ 失败: ${failCount} 项\n`
    resultMsg += `\n💾 释放空间: ${formatSize(freedTotal)}`
    if (recoveryCount > 0) {
      resultMsg += `\n\n💡 提示: 谨慎删除的文件已移至恢复区，可在"恢复区"标签页恢复或永久删除。`
    }
  } else {
    resultMsg = `Processing complete!\n\n`
    if (successCount > 0) resultMsg += `✅ Deleted: ${successCount} items\n`
    if (recoveryCount > 0) resultMsg += `📦 Moved to recovery: ${recoveryCount} items\n`
    if (failCount > 0) resultMsg += `❌ Failed: ${failCount} items\n`
    resultMsg += `\n💾 Freed: ${formatSize(freedTotal)}`
    if (recoveryCount > 0) {
      resultMsg += `\n\n💡 Tip: Cautious items moved to Recovery. Check the Recovery tab to restore or delete permanently.`
    }
  }
  
  if (messages.length > 0 && messages.length <= 5) {
    resultMsg += `\n\n${lang.value === 'zh' ? '详情' : 'Details'}:\n${messages.join('\n')}`
  }
  
  alert(resultMsg)
}

// 获取父目录
function getParentDir(filePath: string): string {
  const parts = filePath.split('\\')
  parts.pop()
  return parts.join('\\')
}

// 初始化时检查管理员状态
if (ipcRenderer) {
  checkAdminStatus()
}

// 恢复区数据
interface RecoveryItem {
  id: string
  originalPath: string
  movedAt: string
  size: number
  recoveryPath: string
}
const recoveryItems = ref<RecoveryItem[]>([])

// 计算属性
const usagePercent = computed(() => {
  if (!diskInfo.value.total) return 0
  return (diskInfo.value.used / diskInfo.value.total) * 100
})

const cleanablePercent = computed(() => {
  if (!diskInfo.value.total) return 0
  return (diskInfo.value.cleanable / diskInfo.value.total) * 100
})

const selectedItems = computed(() => cleanableItems.value.filter(item => item.selected))

const selectedTotalSize = computed(() => 
  selectedItems.value.reduce((sum, item) => sum + item.size, 0)
)

const cleaningProgressPercent = computed(() => {
  if (!cleaningProgress.value.total) return 0
  return (cleaningProgress.value.current / cleaningProgress.value.total) * 100
})

const recoveryTotalSize = computed(() => 
  recoveryItems.value.reduce((sum, item) => sum + item.size, 0)
)

// TOP 20 文件夹
const topFolders = computed(() => {
  const allFolders: FolderData[] = []
  
  const flatten = (items: FolderData[]) => {
    for (const item of items) {
      allFolders.push(item)
      if (item.children) {
        flatten(item.children)
      }
    }
  }
  
  flatten(folderData.value)
  return allFolders.sort((a, b) => b.value - a.value).slice(0, 20)
})

// Treemap 配置 - 优化布局
const treemapOption = computed(() => {
  if (folderData.value.length === 0) return null
  
  return {
    tooltip: {
      trigger: 'item',
      formatter: (info: any) => {
        // 使用 realValue 显示真实大小
        const realSize = info.data?.realValue || info.value
        const size = formatSize(realSize)
        const path = info.data?.path || ''
        return `<div style="padding: 8px; max-width: 300px;">
          <strong style="font-size: 14px;">${info.name}</strong><br/>
          <span style="color: #4ade80; font-size: 16px;">${size}</span><br/>
          <span style="color: #8b949e; font-size: 12px; word-break: break-all;">${path}</span>
        </div>`
      }
    },
    series: [{
      type: 'treemap',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      roam: false,
      squareRatio: 0.7,
      nodeClick: false,
      breadcrumb: {
        show: true,
        height: 28,
        itemStyle: {
          color: '#1e293b'
        },
        emphasis: {
          itemStyle: {
            color: '#334155'
          }
        }
      },
      label: {
        show: true,
        formatter: '{b}',
        fontSize: 13,
        color: '#fff',
        fontWeight: 500,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowBlur: 3
      },
      upperLabel: {
        show: true,
        height: 28,
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: [4, 8]
      },
      itemStyle: {
        borderColor: '#0f172a',
        borderWidth: 2,
        gapWidth: 2
      },
      emphasis: {
        itemStyle: {
          borderColor: '#3b82f6',
          borderWidth: 3
        },
        upperLabel: {
          show: true
        }
      },
      levels: [
        {
          itemStyle: {
            borderWidth: 4,
            borderColor: '#0f172a',
            gapWidth: 4
          },
          upperLabel: {
            show: true
          }
        },
        {
          itemStyle: {
            borderWidth: 2,
            borderColor: '#1e293b',
            gapWidth: 2
          },
          upperLabel: {
            show: true,
            height: 24,
            fontSize: 12
          }
        },
        {
          itemStyle: {
            borderWidth: 1,
            borderColor: '#334155',
            gapWidth: 1
          }
        }
      ],
      data: folderData.value.map((folder, index) => {
        // 使用平方根缩放让大文件夹不会太占空间
        const scaledValue = Math.sqrt(folder.value)
        return {
          name: folder.name,
          value: scaledValue,
          realValue: folder.value, // 保留真实值用于显示
          path: folder.path,
          itemStyle: {
            color: getTreemapColor(index)
          },
          children: folder.children?.map((child, childIndex) => ({
            name: child.name,
            value: Math.sqrt(child.value),
            realValue: child.value,
            path: child.path,
            itemStyle: {
              color: adjustColor(getTreemapColor(index), childIndex)
            }
          }))
        }
      })
    }]
  }
})

// 颜色方案
const colors = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#6366f1', '#f43f5e', '#84cc16', '#14b8a6'
]

function getTreemapColor(index: number): string {
  return colors[index % colors.length]
}

function adjustColor(baseColor: string, index: number): string {
  // 根据 index 调整亮度
  const brightness = 1 - (index % 5) * 0.12
  return adjustBrightness(baseColor, brightness)
}

function adjustBrightness(hex: string, factor: number): string {
  const rgb = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.floor(((rgb >> 16) & 0xff) * factor))
  const g = Math.min(255, Math.floor(((rgb >> 8) & 0xff) * factor))
  const b = Math.min(255, Math.floor((rgb & 0xff) * factor))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取恢复项名称
function getRecoveryItemName(path: string): string {
  const parts = path.split('\\')
  return parts[parts.length - 1] || parts[parts.length - 2] || path
}

// 操作函数
async function startScan() {
  await scan()
}



function selectAllSafe() {
  cleanableItems.value.forEach(item => {
    if (item.safe) item.selected = true
  })
}

function deselectAll() {
  cleanableItems.value.forEach(item => {
    item.selected = false
  })
}

async function performClean() {
  const ids = selectedItems.value.map(item => item.id)
  if (ids.length === 0) return
  
  const confirmMsg = lang.value === 'zh'
    ? `确定要清理选中的 ${ids.length} 个项目吗？\n预计释放: ${formatSize(selectedTotalSize.value)}\n\n⚠️ 注意：临时文件和缓存将被直接删除，无法恢复。`
    : `Clean ${ids.length} selected items?\nEstimated: ${formatSize(selectedTotalSize.value)}\n\n⚠️ Note: Temp files and cache will be permanently deleted.`
  if (!confirm(confirmMsg)) {
    return
  }
  
  await clean(ids)
}

// Treemap 点击处理

function handleTreemapClick(params: any) {
  console.log('Treemap clicked:', params)
  if (params.data && params.data.path) {
    // 设置选中的文件夹
    selectedFolder.value = {
      name: params.data.name,
      value: params.data.realValue || params.data.value,
      path: params.data.path
    }
    console.log('selectedFolder set:', selectedFolder.value)
    
    // 在 DOM 更新后触发 ECharts resize
    nextTick(() => {
      setTimeout(() => {
        if (chartRef.value) {
          chartRef.value.resize()
          console.log('Chart resized')
        }
      }, 50)
    })
  }
}

// 打开文件夹
async function openFolder(folderPath: string) {
  if (ipcRenderer) {
    await ipcRenderer.invoke('open-folder', folderPath)
  }
}

// 恢复区操作
async function loadRecoveryItems() {
  if (ipcRenderer) {
    try {
      const items = await ipcRenderer.invoke('get-recovery-items')
      recoveryItems.value = items || []
    } catch (e) {
      console.error('Failed to load recovery items:', e)
      recoveryItems.value = []
    }
  }
}

async function restoreItem(item: RecoveryItem) {
  const confirmMsg = lang.value === 'zh' 
    ? `确定要恢复 "${getRecoveryItemName(item.originalPath)}" 吗？\n\n文件将恢复到: ${item.originalPath}`
    : `Restore "${getRecoveryItemName(item.originalPath)}"?\n\nFile will be restored to: ${item.originalPath}`
  if (!confirm(confirmMsg)) {
    return
  }
  
  isRestoring.value = true
  try {
    if (ipcRenderer) {
      const result = await ipcRenderer.invoke('restore-item', item.recoveryPath)
      if (result.success) {
        await loadRecoveryItems()
        alert(lang.value === 'zh' ? `恢复成功！已恢复 ${formatSize(result.restoredSize || item.size)}` : `Restored successfully! ${formatSize(result.restoredSize || item.size)}`)
      } else {
        alert((lang.value === 'zh' ? '恢复失败: ' : 'Restore failed: ') + (result.error || (lang.value === 'zh' ? '未知错误' : 'Unknown error')))
      }
    }
  } finally {
    isRestoring.value = false
  }
}

async function permanentDelete(item: RecoveryItem) {
  const confirmMsg = lang.value === 'zh'
    ? `⚠️ 警告：永久删除后无法恢复！\n\n确定要永久删除 "${getRecoveryItemName(item.originalPath)}" 吗？`
    : `⚠️ Warning: Cannot be undone!\n\nPermanently delete "${getRecoveryItemName(item.originalPath)}"?`
  if (!confirm(confirmMsg)) {
    return
  }
  
  isRestoring.value = true
  try {
    if (ipcRenderer) {
      const result = await ipcRenderer.invoke('permanent-delete', item.recoveryPath)
      if (result.success) {
        await loadRecoveryItems()
        alert(lang.value === 'zh' ? `已永久删除，释放 ${formatSize(result.deletedSize || item.size)}` : `Permanently deleted, freed ${formatSize(result.deletedSize || item.size)}`)
      } else {
        alert((lang.value === 'zh' ? '删除失败: ' : 'Delete failed: ') + (result.error || (lang.value === 'zh' ? '未知错误' : 'Unknown error')))
      }
    }
  } finally {
    isRestoring.value = false
  }
}

async function clearAllRecovery() {
  const confirmMsg = lang.value === 'zh'
    ? `⚠️ 警告：此操作将永久删除恢复区中的所有 ${recoveryItems.value.length} 个项目！\n\n删除后无法恢复，确定继续吗？`
    : `⚠️ Warning: This will permanently delete all ${recoveryItems.value.length} items in recovery!\n\nCannot be undone. Continue?`
  if (!confirm(confirmMsg)) {
    return
  }
  
  isRestoring.value = true
  try {
    for (const item of recoveryItems.value) {
      if (ipcRenderer) {
        await ipcRenderer.invoke('permanent-delete', item.recoveryPath)
      }
    }
    await loadRecoveryItems()
    alert(lang.value === 'zh' ? '恢复区已清空' : 'Recovery zone cleared')
  } finally {
    isRestoring.value = false
  }
}

// 初始化
onMounted(() => {
  console.log('App mounted - ready for manual scan')
  loadRecoveryItems()
})
</script>

<style>
@import './assets/main.css';
</style>
