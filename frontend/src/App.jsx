import React, { useState, useCallback, useEffect } from 'react'
import api from './api/client'
import UploadScreen from './components/UploadScreen'
import Sidebar from './components/Sidebar'
import OverviewTab from './components/tabs/OverviewTab'
import CleaningTab from './components/tabs/CleaningTab'
import StatsTab from './components/tabs/StatsTab'
import ChartsTab from './components/tabs/ChartsTab'
import CorrelationTab from './components/tabs/CorrelationTab'
import MLTab from './components/tabs/MLTab'
import RecommendationsTab from './components/tabs/RecommendationsTab'
import ReportTab from './components/tabs/ReportTab'
import { Spinner } from './components/Primitives'

export default function App() {
  const [dataset, setDataset] = useState(null) // { id, filename, profile, preview }
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // per-tab lazy-loaded state
  const [stats, setStats] = useState(null)
  const [correlation, setCorrelation] = useState(null)
  const [mlResult, setMlResult] = useState(null)
  const [mlRunning, setMlRunning] = useState(false)
  const [recommendations, setRecommendations] = useState(null)
  const [recLoading, setRecLoading] = useState(false)
  const [cleaningLog, setCleaningLog] = useState([])
  const [applying, setApplying] = useState(false)
  const [reportUrl, setReportUrl] = useState(null)
  const [reportGenerating, setReportGenerating] = useState(false)

  const handleUpload = useCallback(async (file) => {
    setUploading(true)
    setUploadError(null)
    try {
      const data = await api.upload(file)
      setDataset({
        id: data.dataset_id,
        filename: data.filename,
        profile: data.profile,
        preview: { columns: Object.keys(data.preview[0] || {}), rows: data.preview, total_rows: data.profile.overview.n_rows },
      })
      setActiveTab('overview')
    } catch (e) {
      setUploadError(e?.response?.data?.detail || 'Could not process this file. Check the format and try again.')
    } finally {
      setUploading(false)
    }
  }, [])

  const refreshProfile = useCallback(async (id) => {
    const profile = await api.getProfile(id)
    const preview = await api.getPreview(id, 25)
    setDataset((prev) => ({ ...prev, profile, preview }))
  }, [])

  const handleApplyCleaning = useCallback(async (actions) => {
    if (!dataset) return
    setApplying(true)
    try {
      const res = await api.applyCleaning(dataset.id, actions)
      setCleaningLog((prev) => [...prev, ...res.log])
      await refreshProfile(dataset.id)
      // invalidate downstream cached results since data changed
      setStats(null); setCorrelation(null); setMlResult(null); setRecommendations(null); setReportUrl(null)
    } finally {
      setApplying(false)
    }
  }, [dataset, refreshProfile])

  const handleApplyAll = useCallback(async () => {
    if (!dataset?.profile?.cleaning_suggestions?.length) return
    const actions = dataset.profile.cleaning_suggestions
      .filter((s) => s.action !== 'flag_outliers')
      .map((s) => ({ action: s.action, column: s.column }))
    await handleApplyCleaning(actions)
  }, [dataset, handleApplyCleaning])

  const handleReset = useCallback(async () => {
    if (!dataset) return
    setApplying(true)
    try {
      await api.resetCleaning(dataset.id)
      setCleaningLog([])
      await refreshProfile(dataset.id)
      setStats(null); setCorrelation(null); setMlResult(null); setRecommendations(null); setReportUrl(null)
    } finally {
      setApplying(false)
    }
  }, [dataset, refreshProfile])

  // lazy-load stats / correlation when their tabs are opened
  useEffect(() => {
    if (!dataset) return
    if (activeTab === 'stats' && !stats) {
      api.getStats(dataset.id).then(setStats)
    }
    if (activeTab === 'correlation' && !correlation) {
      api.getCorrelation(dataset.id).then(setCorrelation)
    }
  }, [activeTab, dataset, stats, correlation])

  const handleRunML = useCallback(async (target) => {
    if (!dataset) return
    setMlRunning(true)
    try {
      const result = await api.runML(dataset.id, target, null)
      setMlResult(result)
    } catch (e) {
      setMlResult({ error: e?.response?.data?.detail || 'Model training failed on this dataset.' })
    } finally {
      setMlRunning(false)
    }
  }, [dataset])

  useEffect(() => {
    if (!dataset) return
    if (activeTab === 'recommendations' && !recommendations) {
      setRecLoading(true)
      api.getRecommendations(dataset.id, mlResult?.target || null)
        .then((r) => setRecommendations(r.recommendations))
        .finally(() => setRecLoading(false))
    }
  }, [activeTab, dataset, recommendations, mlResult])

  const handleGenerateReport = useCallback(async (target, includeML) => {
    if (!dataset) return
    setReportGenerating(true)
    try {
      await api.createReport(dataset.id, target, includeML)
      setReportUrl(api.reportDownloadUrl(dataset.id))
    } finally {
      setReportGenerating(false)
    }
  }, [dataset])

  const handleNewDataset = useCallback(async () => {
    if (dataset) {
      try { await api.deleteDataset(dataset.id) } catch {}
    }
    setDataset(null)
    setStats(null); setCorrelation(null); setMlResult(null); setRecommendations(null)
    setCleaningLog([]); setReportUrl(null); setActiveTab('overview')
  }, [dataset])

  if (!dataset) {
    return <UploadScreen onUpload={handleUpload} loading={uploading} error={uploadError} />
  }

  const columnNames = dataset.profile?.overview?.column_names || []

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        active={activeTab}
        onSelect={setActiveTab}
        filename={dataset.filename}
        rowCount={dataset.profile?.overview?.n_rows}
        colCount={dataset.profile?.overview?.n_columns}
        onNewDataset={handleNewDataset}
      />
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1120 }}>
        {activeTab === 'overview' && <OverviewTab profile={dataset.profile} preview={dataset.preview} />}
        {activeTab === 'cleaning' && (
          <CleaningTab
            profile={dataset.profile}
            onApply={handleApplyCleaning}
            onApplyAll={handleApplyAll}
            onReset={handleReset}
            applying={applying}
            log={cleaningLog}
          />
        )}
        {activeTab === 'stats' && (
          stats ? <StatsTab stats={stats} /> : <LoadingBlock label="Computing statistics…" />
        )}
        {activeTab === 'charts' && <ChartsTab datasetId={dataset.id} />}
        {activeTab === 'correlation' && (
          correlation ? <CorrelationTab correlation={correlation} /> : <LoadingBlock label="Computing correlations…" />
        )}
        {activeTab === 'ml' && (
          <MLTab columns={columnNames} onRun={handleRunML} result={mlResult} running={mlRunning} />
        )}
        {activeTab === 'recommendations' && (
          <RecommendationsTab recommendations={recommendations} loading={recLoading} />
        )}
        {activeTab === 'report' && (
          <ReportTab columns={columnNames} onGenerate={handleGenerateReport} downloadUrl={reportUrl} generating={reportGenerating} />
        )}
      </main>
    </div>
  )
}

function LoadingBlock({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
      <Spinner size={22} />
      <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>{label}</div>
    </div>
  )
}
