import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { loadSettlementData, saveSettlementData, debounce, saveMonthlyRecord, getMonthlyRecords } from './firestore.js'
import ExpenseItem from './ExpenseItem.jsx'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement)

function getCurrentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function SettlementCalculator() {
  const [mine, setMine] = useState([])
  const [siblings, setSiblings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('')
  const [monthlyRecords, setMonthlyRecords] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [activeTab, setActiveTab] = useState('mine')

  // 월 선택 저장 모달
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveTargetMonth, setSaveTargetMonth] = useState(getCurrentYearMonth())

  // 덮어쓰기 확인
  const [overwriteTarget, setOverwriteTarget] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setSaveStatus('loading')
        const data = await loadSettlementData()
        setMine(data.mine)
        setSiblings(data.siblings)
        setLoading(false)
        setSaveStatus('done')
        setTimeout(() => setSaveStatus(''), 2000)
      } catch {
        setLoading(false)
        setSaveStatus('offline')
        setTimeout(() => setSaveStatus(''), 4000)
      }
    }
    loadData()
  }, [])

  const refreshMonthlyRecords = useCallback(async () => {
    try {
      const records = await getMonthlyRecords()
      setMonthlyRecords(records)
    } catch { /* noop */ }
  }, [])

  useEffect(() => { refreshMonthlyRecords() }, [refreshMonthlyRecords])

  const totalMine = mine.reduce((sum, r) => sum + r.amount, 0)
  const totalSiblings = siblings.reduce((sum, r) => sum + r.amount, 0)
  const settlementAmount = (totalMine - totalSiblings) / 2

  const fmt = (num) => new Intl.NumberFormat('ko-KR').format(Math.round(num))

  const debouncedSave = useCallback(
    debounce(async (mineData, siblingsData) => {
      try { await saveSettlementData(mineData, siblingsData) } catch { /* noop */ }
    }, 2000),
    []
  )

  useEffect(() => {
    if (mine.length > 0 || siblings.length > 0) {
      const timeoutId = setTimeout(() => debouncedSave(mine, siblings), 100)
      return () => clearTimeout(timeoutId)
    }
  }, [mine, siblings, debouncedSave])

  const updateRow = (owner, id, field, value) => {
    const setter = owner === 'mine' ? setMine : setSiblings
    setter(prev => prev.map(row =>
      row.id === id ? {
        ...row,
        [field]: field === 'amount' ? (typeof value === 'string' ? parseFloat(value) || 0 : value) : value
      } : row
    ))
  }

  const addRow = (owner) => {
    const setter = owner === 'mine' ? setMine : setSiblings
    const newId = `${owner}-${Date.now()}`
    setter(prev => [...prev, { id: newId, name: '', amount: 0, fixed: false }])
  }

  const deleteRow = (owner, id) => {
    const setter = owner === 'mine' ? setMine : setSiblings
    setter(prev => prev.filter(row => row.id !== id))
  }

  // 월 선택 후 저장
  const handleSaveToMonth = async () => {
    try {
      setSaveStatus('saving')
      setShowSaveModal(false)
      await saveMonthlyRecord(saveTargetMonth)
      setSaveStatus('saved')
      await refreshMonthlyRecords()
      setTimeout(() => setSaveStatus(''), 3000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(''), 4000)
    }
  }

  // 기존 기록을 덮어쓰기 (현재 데이터로 해당 월 재저장)
  const handleOverwriteRecord = async (yearMonth) => {
    try {
      setSaveStatus('saving')
      setOverwriteTarget(null)
      await saveMonthlyRecord(yearMonth)
      setSaveStatus('saved')
      await refreshMonthlyRecords()
      setTimeout(() => setSaveStatus(''), 3000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(''), 4000)
    }
  }

  // 월 선택 옵션 생성 (최근 12개월)
  const monthOptions = useMemo(() => {
    const options = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const hasRecord = monthlyRecords.some(r => r.yearMonth === ym)
      options.push({ value: ym, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`, hasRecord })
    }
    return options
  }, [monthlyRecords])

  const chartData = useMemo(() => {
    if (monthlyRecords.length === 0) return null
    const sorted = [...monthlyRecords].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
    return {
      labels: sorted.map(r => r.yearMonth),
      datasets: [
        {
          label: '정산금',
          data: sorted.map(r => r.settlementAmount),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#6366f1',
        },
        {
          label: '재우 명의',
          data: sorted.map(r => r.totalMine),
          borderColor: '#3b82f6', backgroundColor: 'transparent',
          tension: 0.4, borderDash: [5, 5], pointRadius: 3,
        },
        {
          label: '재경 명의',
          data: sorted.map(r => r.totalSiblings),
          borderColor: '#10b981', backgroundColor: 'transparent',
          tension: 0.4, borderDash: [5, 5], pointRadius: 3,
        },
      ],
    }
  }, [monthlyRecords])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { size: 11 } } },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { callback: v => fmt(v) + '원', font: { size: 10 } },
      },
    },
  }

  const statusMessages = {
    loading: { text: '데이터 불러오는 중...', bg: 'bg-indigo-50 text-indigo-600' },
    done: { text: '불러오기 완료', bg: 'bg-green-50 text-green-600' },
    offline: { text: '오프라인 모드', bg: 'bg-amber-50 text-amber-600' },
    saving: { text: '저장 중...', bg: 'bg-indigo-50 text-indigo-600' },
    saved: { text: '저장 완료!', bg: 'bg-green-50 text-green-600' },
    error: { text: '실패 — 다시 시도해주세요', bg: 'bg-red-50 text-red-600' },
  }

  const currentItems = activeTab === 'mine' ? mine : siblings

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="px-5 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">정산 계산기</h1>
          <span className="text-xs font-medium text-gray-400 tabular-nums">
            {new Date().getFullYear()}.{String(new Date().getMonth() + 1).padStart(2, '0')}
          </span>
        </div>
        {saveStatus && statusMessages[saveStatus] && (
          <div className={`mx-5 mb-3 px-3 py-2 rounded-lg text-xs font-medium text-center ${statusMessages[saveStatus].bg} animate-fade-in`}>
            {statusMessages[saveStatus].text}
          </div>
        )}
      </header>

      <div className="px-5 pt-5 space-y-5">
        {/* Settlement Result */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-200">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/5 rounded-full" />

          <p className="text-indigo-100 text-xs font-medium mb-1 relative">이번 달 정산 결과</p>
          <div className="text-3xl font-extrabold tracking-tight mb-1 relative">
            {settlementAmount > 0 ? '+' : ''}{fmt(Math.round(settlementAmount))}<span className="text-lg font-semibold ml-0.5">원</span>
          </div>
          <p className="text-indigo-200 text-xs relative">
            {settlementAmount > 0
              ? '재경 → 재우에게 보내야 할 금액'
              : settlementAmount < 0
                ? '재우 → 재경에게 보내야 할 금액'
                : '정산 완료! 추가 이체 없음'}
          </p>

          <div className="flex items-center gap-2 mt-4 relative">
            <SummaryPill label="재우" amount={fmt(totalMine)} />
            <span className="text-indigo-200 text-sm">−</span>
            <SummaryPill label="재경" amount={fmt(totalSiblings)} />
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <ActionButton onClick={() => { setSaveTargetMonth(getCurrentYearMonth()); setShowSaveModal(true) }} icon="💾" label="기록 저장" />
          <ActionButton onClick={() => setShowHistory(true)} icon="📋" label="월별 기록" />
          <ActionButton onClick={() => setShowChart(true)} icon="📈" label="추이 차트" />
        </div>

        {/* Tab Switcher */}
        <div className="bg-gray-100 rounded-xl p-1 flex">
          <TabButton active={activeTab === 'mine'} onClick={() => setActiveTab('mine')} color="blue" label="재우 명의" amount={fmt(totalMine)} />
          <TabButton active={activeTab === 'siblings'} onClick={() => setActiveTab('siblings')} color="emerald" label="재경 명의" amount={fmt(totalSiblings)} />
        </div>

        {/* Expense Items */}
        <div className="space-y-2.5">
          {currentItems.length === 0 ? (
            <div className="text-center py-12 animate-fade-in">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-sm text-gray-400 mb-4">아직 항목이 없습니다</p>
              <button
                onClick={() => addRow(activeTab)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600 active:scale-95 transition-all"
              >
                <span className="text-base">+</span> 첫 항목 추가하기
              </button>
            </div>
          ) : (
            <>
              {currentItems.map((item, i) => (
                <div key={item.id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <ExpenseItem owner={activeTab} item={item} updateRow={updateRow} deleteRow={deleteRow} />
                </div>
              ))}
              <button
                onClick={() => addRow(activeTab)}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-400 hover:border-indigo-300 hover:text-indigo-500 active:scale-[0.98] transition-all"
              >
                + 항목 추가
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Save to Month Modal ── */}
      {showSaveModal && (
        <BottomSheet onClose={() => setShowSaveModal(false)} title="기록 저장할 월 선택">
          <div className="px-5 pb-6 space-y-4">
            <p className="text-xs text-gray-400">현재 입력된 정산 데이터를 선택한 월에 저장합니다.</p>

            <div className="grid grid-cols-3 gap-2">
              {monthOptions.map(opt => {
                const selected = saveTargetMonth === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSaveTargetMonth(opt.value)}
                    className={`relative py-3 px-2 rounded-xl text-sm font-medium transition-all border-2
                      ${selected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'}`}
                  >
                    {opt.label}
                    {opt.hasRecord && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" title="기존 기록 있음" />
                    )}
                  </button>
                )
              })}
            </div>

            {monthOptions.find(o => o.value === saveTargetMonth)?.hasRecord && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
                <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                <p className="text-xs text-amber-700">
                  {saveTargetMonth} 기록이 이미 있습니다. 저장하면 기존 기록을 덮어씁니다.
                </p>
              </div>
            )}

            <button
              onClick={handleSaveToMonth}
              className="w-full py-3 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 active:scale-[0.98] transition-all"
            >
              {saveTargetMonth} 기록 저장
            </button>
          </div>
        </BottomSheet>
      )}

      {/* ── History Modal ── */}
      {showHistory && (
        <BottomSheet onClose={() => setShowHistory(false)} title="월별 정산 기록">
          {monthlyRecords.length > 0 ? (
            <div className="space-y-2.5 px-5 pb-8">
              {monthlyRecords.map((record) => (
                <div key={record.yearMonth} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-800">{record.yearMonth}</span>
                    <span className={`text-sm font-bold ${record.settlementAmount > 0 ? 'text-indigo-600' : record.settlementAmount < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                      {record.settlementAmount > 0 ? '+' : ''}{fmt(Math.round(record.settlementAmount))}원
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    재우 {fmt(record.totalMine)}원 · 재경 {fmt(record.totalSiblings)}원
                  </div>
                  <button
                    onClick={() => setOverwriteTarget(record.yearMonth)}
                    className="w-full py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 active:scale-[0.97] transition-all"
                  >
                    현재 데이터로 덮어쓰기
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400 text-sm">
              아직 저장된 기록이 없습니다
            </div>
          )}
        </BottomSheet>
      )}

      {/* ── Overwrite Confirm ── */}
      {overwriteTarget && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOverwriteTarget(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs animate-modal" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">기록 덮어쓰기</h3>
            <p className="text-sm text-gray-500 mb-5">
              <strong>{overwriteTarget}</strong> 기록을 현재 정산 데이터로 덮어쓰시겠습니까?
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setOverwriteTarget(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 active:scale-[0.97] transition-all"
              >
                취소
              </button>
              <button
                onClick={() => handleOverwriteRecord(overwriteTarget)}
                className="flex-1 py-2.5 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600 active:scale-[0.97] transition-all"
              >
                덮어쓰기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chart Modal ── */}
      {showChart && (
        <BottomSheet onClose={() => setShowChart(false)} title="정산 추이">
          <div className="px-5 pb-8">
            {chartData ? (
              <div className="h-64 bg-white rounded-xl p-3">
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400 text-sm">
                표시할 데이터가 없습니다
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

function SummaryPill({ label, amount }) {
  return (
    <div className="bg-white/15 rounded-lg px-3 py-1.5 flex items-center gap-2">
      <span className="text-[11px] text-indigo-100">{label}</span>
      <span className="text-sm font-bold">{amount}원</span>
    </div>
  )
}

function ActionButton({ onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 bg-white rounded-xl py-2.5 text-xs font-medium text-gray-600 shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-[0.97] transition-all"
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

function TabButton({ active, onClick, color, label, amount }) {
  const colors = {
    blue: active ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
    emerald: active ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500',
  }
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${colors[color]}`}
    >
      {label} <span className="text-xs font-normal opacity-70">{amount}원</span>
    </button>
  )
}

function BottomSheet({ onClose, title, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-[480px] max-h-[85vh] rounded-t-2xl overflow-hidden animate-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-lg"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
