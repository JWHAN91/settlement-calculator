import React, { useState, useRef, useEffect } from 'react'

const ExpenseItem = React.memo(({ owner, item, updateRow, deleteRow }) => {
  const fmt = (num) => new Intl.NumberFormat('ko-KR').format(Math.round(num))
  const [localAmount, setLocalAmount] = useState(item.amount === 0 ? '' : fmt(item.amount))
  const [swiped, setSwiped] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef(null)
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const rowRef = useRef(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalAmount(item.amount === 0 ? '' : fmt(item.amount))
    }
  }, [item.amount])

  const handleAmountChange = (e) => {
    const value = e.target.value
    const numericValue = value.replace(/[,\s]/g, '')
    if (numericValue === '' || /^\d+$/.test(numericValue)) {
      const parsedValue = numericValue === '' ? 0 : parseInt(numericValue)
      setLocalAmount(parsedValue === 0 ? '' : fmt(parsedValue))
      updateRow(owner, item.id, 'amount', parsedValue)
    }
  }

  const handleAmountBlur = () => {
    const numericValue = localAmount === '' ? 0 : parseInt(localAmount.replace(/[,\s]/g, ''))
    if (numericValue !== item.amount) {
      updateRow(owner, item.id, 'amount', numericValue)
    }
    setLocalAmount(numericValue === 0 ? '' : fmt(numericValue))
  }

  const handleTouchStart = (e) => {
    if (item.fixed || e.target.tagName === 'INPUT') return
    touchStartX.current = e.touches[0].clientX
    touchCurrentX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    if (item.fixed || e.target.tagName === 'INPUT') return
    touchCurrentX.current = e.touches[0].clientX
    const diff = touchStartX.current - touchCurrentX.current
    if (diff > 60) {
      setSwiped(true)
    } else if (diff < -30) {
      setSwiped(false)
    }
  }

  const handleTouchEnd = () => {
    touchStartX.current = 0
    touchCurrentX.current = 0
  }

  const confirmDelete = () => {
    deleteRow(owner, item.id)
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <div
        ref={rowRef}
        className="relative overflow-hidden rounded-xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Delete button revealed by swipe */}
        {!item.fixed && (
          <div className="absolute right-0 top-0 bottom-0 flex items-center">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className={`h-full px-5 bg-rose-500 text-white text-xs font-semibold transition-all duration-200 ${swiped ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
            >
              삭제
            </button>
          </div>
        )}

        <div
          className={`relative bg-white rounded-xl p-4 border border-gray-100 transition-transform duration-200 ${swiped ? '-translate-x-16' : 'translate-x-0'}`}
        >
          <div className="flex items-center gap-3">
            {/* Name input */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateRow(owner, item.id, 'name', e.target.value)}
                placeholder="항목명"
                className="w-full text-sm font-medium text-gray-800 bg-transparent outline-none placeholder-gray-300 truncate"
              />
            </div>

            {/* Amount input */}
            <div className="flex items-center bg-gray-50 rounded-lg shrink-0">
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                value={localAmount}
                onChange={handleAmountChange}
                onBlur={handleAmountBlur}
                className="w-28 text-right text-sm font-semibold text-gray-800 bg-transparent px-3 py-2 outline-none"
                placeholder="0"
              />
              <span className="pr-3 text-xs text-gray-400">원</span>
            </div>

            {/* Delete icon (desktop) */}
            {!item.fixed && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full text-gray-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
                aria-label="삭제"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {item.fixed && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-full">
              고정 항목
            </span>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-xs animate-modal"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-1">항목 삭제</h3>
            <p className="text-sm text-gray-500 mb-5">
              {item.name ? `"${item.name}"` : '이 항목'}을(를) 삭제하시겠습니까?
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 active:scale-[0.97] transition-all"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-500 text-white text-sm font-medium rounded-xl hover:bg-rose-600 active:scale-[0.97] transition-all"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

ExpenseItem.displayName = 'ExpenseItem'

export default ExpenseItem
