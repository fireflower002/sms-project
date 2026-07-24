'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, Search, AlertTriangle, Plus, Package, SlidersHorizontal, Laptop, FlaskConical, Trophy, BookOpen, Music, TestTube, ShieldAlert, Pencil, Trash2, QrCode, Printer, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'

const styles: { [key: string]: React.CSSProperties } = {
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', minHeight: '44px', padding: '10px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.2s ease', textDecoration: 'none', boxSizing: 'border-box' },
  buttonPrimary: { background: H.mintGreen, color: '#FFFFFF' },
  buttonSecondary: { background: '#F5F5F4', color: H.textSec, border: `1px solid ${H.border}` },
};

const CATEGORIES = ['All','Electronics','Lab Equipment','Sports Equipment','Books & Stationery','Furniture','Musical Instruments','Chemicals','Safety Equipment','Other'];

function getCategoryIcon(cat: string) {
  switch (cat) {
    case 'Electronics': return <Laptop size={22} color={H.textPrimary} />
    case 'Lab Equipment': return <FlaskConical size={22} color={H.textPrimary} />
    case 'Sports Equipment': return <Trophy size={22} color={H.textPrimary} />
    case 'Books & Stationery': return <BookOpen size={22} color={H.textPrimary} />
    case 'Musical Instruments': return <Music size={22} color={H.textPrimary} />
    case 'Chemicals': return <TestTube size={22} color={H.textPrimary} />
    case 'Safety Equipment': return <ShieldAlert size={22} color={H.textPrimary} />
    default: return <Package size={22} color={H.textPrimary} />
  }
}

const COND_STYLE: Record<string, { background: string; color: string }> = {
  new: { background: '#D1FAE5', color: '#065F46' },
  good: { background: '#DCFCE7', color: '#166534' },
  fair: { background: '#FEF3C7', color: '#92400E' },
  poor: { background: '#FFE4E6', color: '#9F1239' },
  damaged: { background: '#FEE2E2', color: '#991B1B' },
  retired: { background: '#F3F4F6', color: '#4B5563' },
};

const printStickersWindow = (itemsToPrint: any[], title: string) => {
  const printWin = window.open('', '_blank')
  if (!printWin) return
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 10px; background: #fff; color: #000; }
          .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #333; }
          .header h1 { margin: 0 0 4px; font-size: 20px; }
          .header p { margin: 0; font-size: 12px; color: #666; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
          .sticker {
            border: 2px dashed #06B6D4;
            border-radius: 12px;
            padding: 14px;
            text-align: center;
            box-sizing: border-box;
            page-break-inside: avoid;
            background: #fff;
          }
          .sticker-title { font-weight: 800; font-size: 13px; margin: 0 0 4px; color: #111; word-break: break-word; }
          .sticker-meta { font-size: 10px; color: #555; margin: 0 0 8px; font-family: monospace; font-weight: 700; }
          .sticker-qr { width: 110px; height: 110px; margin: 0 auto; display: block; }
          .sticker-footer { font-size: 9px; color: #666; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>School Inventory - QR Code Sticker Sheet</h1>
          <p>Generated on ${new Date().toLocaleDateString()} | Total Stickers: ${itemsToPrint.length}</p>
        </div>
        <div class="grid">
          ${itemsToPrint.map(item => {
            const code = item.barcode || `INV-2026-${(item.id || '').slice(0, 5)}`
            const token = item.public_token || item.id
            const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/item/${token}` : token
            return `
              <div class="sticker">
                <div class="sticker-title">${item.name}</div>
                <div class="sticker-meta">${item.category} | ${code}</div>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}" class="sticker-qr" alt="QR" />
                <div class="sticker-footer">Scan to verify item</div>
              </div>
            `
          }).join('')}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
    </html>
  `
  printWin.document.write(html)
  printWin.document.close()
}

// SUB-COMPONENTS ==============================================================

const InventoryItemCard = ({ item, onDelete, onShowQr }: { item: any; onDelete: (item: any) => void; onShowQr: (item: any) => void }) => {
  const isLow = item.quantity_available <= item.low_stock_threshold;

  return (
    <div style={{ ...styles.card, padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: 44, height: 44, borderRadius: '12px', background: H.mintLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {getCategoryIcon(item.category)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, color: H.textPrimary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '15px' }}>{item.name}</p>
          <p style={{ fontSize: '13px', color: H.textSec, margin: '3px 0 0' }}>{item.category}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isLow && <AlertTriangle size={18} style={{ color: H.accent }} />}
          <button
            onClick={() => onShowQr(item)}
            title="View & Print QR Sticker"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '8px',
              border: `1px solid ${H.border}`,
              background: '#F5F5F4',
              color: H.textSec,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <QrCode size={14} />
          </button>
          <Link
            href={`/admin/inventory/new?id=${item.id}`}
            title="Edit item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '8px',
              border: `1px solid ${H.border}`,
              background: '#F5F5F4',
              color: H.textSec,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Pencil size={14} />
          </Link>
          <button
            onClick={() => onDelete(item)}
            title="Delete item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.2)',
              background: 'rgba(239,68,68,0.06)',
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: H.bg, padding: '12px', borderRadius: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px 0' }}>Available</p>
          <p style={{ fontSize: '24px', fontWeight: 800, color: isLow ? H.danger : H.textPrimary, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{item.quantity_available}</p>
        </div>
        <div style={{ background: H.bg, padding: '12px', borderRadius: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px 0' }}>Total</p>
          <p style={{ fontSize: '24px', fontWeight: 800, color: H.textSec, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{item.quantity_total}</p>
        </div>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Badge variant="custom" bg={COND_STYLE[item.condition]?.background || COND_STYLE.retired.background} color={COND_STYLE[item.condition]?.color || COND_STYLE.retired.color} style={{ textTransform: 'capitalize' }}>{item.condition || 'Unknown'}</Badge>
      </div>
    </div>
  )
}

// MAIN PAGE COMPONENT ========================================================
export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showLowStock, setShowLowStock] = useState(false)
  const [stats, setStats] = useState({ total: 0, assigned: 0, lowStock: 0, categories: 0 })
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [singleQrItem, setSingleQrItem] = useState<any | null>(null)
  const [showBatchQrModal, setShowBatchQrModal] = useState(false)
  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('inventory').select('*').eq('is_active', true).order('name')
      if (search) query = query.ilike('name', `%${search}%`)
      if (category !== 'All') query = query.eq('category', category)

      const { data } = await query
      let list = data || []
      if (showLowStock) list = list.filter(i => i.quantity_available <= i.low_stock_threshold)
      setItems(list)

      const { data: allItems } = await supabase.from('inventory').select('category,quantity_available,low_stock_threshold').eq('is_active', true)
      const all = allItems || []
      const { count: assignedCount } = await supabase.from('inventory_assignments').select('id', { count: 'exact', head: true }).eq('is_active', true)
      setStats({
        total: all.length,
        assigned: assignedCount || 0,
        lowStock: all.filter(i => i.quantity_available <= i.low_stock_threshold).length,
        categories: new Set(all.map(i => i.category)).size
      })
    } finally {
      setLoading(false)
    }
  }, [search, category, showLowStock, supabase])

  const handleDeleteItem = async (itemToDelete: any) => {
    if (!itemToDelete?.id) return
    const confirmDelete = window.confirm(`Are you sure you want to delete "${itemToDelete.name}"?`)
    if (!confirmDelete) return

    try {
      const { error: updateErr } = await supabase
        .from('inventory')
        .update({ is_active: false })
        .eq('id', itemToDelete.id)

      if (updateErr) {
        const { error: delErr } = await supabase
          .from('inventory')
          .delete()
          .eq('id', itemToDelete.id)
        if (delErr) throw delErr
      }

      setItems(prev => prev.filter(i => i.id !== itemToDelete.id))
      fetchItems()
    } catch (err: any) {
      alert(err.message || 'Failed to delete item.')
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => fetchItems(), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchItems, search])

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

        {/* Contiguous Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.mintLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} style={{ color: H.mintGreen }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Inventory Management</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {stats.total} total items • {stats.categories} categories
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={fetchItems} style={{ ...styles.button, ...styles.buttonSecondary, padding: '8px 12px' }} title="Refresh">
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
            <button
              onClick={() => setShowBatchQrModal(true)}
              style={{ ...styles.button, ...styles.buttonSecondary, borderRadius: '10px', minHeight: '38px', fontSize: '13px' }}
              title="Generate printable QR sheet for all items"
            >
              <QrCode size={14} /> Batch QR Sheet
            </button>
            <Link href="/admin/inventory/new" style={{ ...styles.button, ...styles.buttonPrimary, borderRadius: '10px', minHeight: '38px', fontSize: '13px' }}>
              <Plus size={14} /> Add Item
            </Link>
          </div>
        </div>

        {/* Contiguous Metric Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', borderBottom: `1px solid ${H.border}`, backgroundColor: H.surface }}>
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRight: `1px solid ${H.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.mintLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} style={{ color: '#0E7490' }} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: H.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.total}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Total Items</div>
            </div>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRight: `1px solid ${H.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SlidersHorizontal size={18} style={{ color: '#4B5563' }} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: H.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.categories}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Categories</div>
            </div>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: stats.lowStock > 0 ? '#FFFBEB' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} style={{ color: stats.lowStock > 0 ? '#B45309' : '#15803D' }} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: H.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.lowStock}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Low Stock</div>
            </div>
          </div>
        </div>

        {/* Integrated Filter Toolbar */}
        <div style={{ padding: '16px 24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAF9F6' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: H.textMuted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search items..."
              style={{ ...styles.button, width: '100%', paddingLeft: '36px', minHeight: '38px', fontSize: '13px', background: H.surface, color: H.textPrimary, border: `1px solid ${isSearchFocused ? H.mintGreen : H.border}` }}
            />
          </div>
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{ padding: '6px 12px', borderRadius: '8px', border: category === c ? `1px solid ${H.border}` : 'none', background: category === c ? H.surface : 'transparent', color: category === c ? H.textPrimary : H.textSec, fontWeight: category === c ? 600 : 500, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {c}
              </button>
            ))}
          </div>
          <button onClick={() => setShowLowStock(x => !x)} style={{ ...styles.button, minHeight: '38px', fontSize: '12px', background: showLowStock ? H.accent : H.surface, color: showLowStock ? 'white' : H.textSec, border: `1px solid ${showLowStock ? H.accent : H.border}` }}>
            <AlertTriangle size={14} /> Low Stock Only
          </button>
        </div>

        {/* Item Grid */}
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full" style={{ width: '100%' }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{ ...styles.card, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <SkeletonBlock width="48px" height="48px" borderRadius="12px" />
                    <div style={{ flex: 1 }}>
                      <SkeletonBlock width="70%" height="16px" style={{ marginBottom: '6px' }} />
                      <SkeletonBlock width="40%" height="12px" />
                    </div>
                  </div>
                  <SkeletonBlock width="100%" height="32px" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <EmptyState title="No Items Found" description="No inventory items match the current filters." />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full" style={{ width: '100%' }}>
              {items.map(item => (
                <InventoryItemCard key={item.id} item={item} onDelete={handleDeleteItem} onShowQr={setSingleQrItem} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SINGLE ITEM QR MODAL */}
      {singleQrItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: H.surface, border: `1px solid ${H.border}`, borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <QrCode size={18} color={H.mintGreen} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: H.textPrimary }}>Item QR Sticker</h3>
              </div>
              <button onClick={() => setSingleQrItem(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: H.textSec }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ border: '2px dashed #06B6D4', borderRadius: 12, padding: 20, textAlign: 'center', background: '#FAFAFA', marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 800, color: H.textPrimary }}>{singleQrItem.name}</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: H.textSec, fontFamily: 'DM Mono, monospace' }}>
                {singleQrItem.category} | {singleQrItem.barcode || `INV-2026-${singleQrItem.id.slice(0, 5)}`}
              </p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/item/${singleQrItem.public_token || singleQrItem.id}` : singleQrItem.public_token || singleQrItem.id)}`}
                alt="QR Code"
                style={{ width: 140, height: 140, margin: '0 auto', display: 'block', borderRadius: 8, border: `1px solid ${H.border}`, padding: 6, background: '#fff' }}
              />
              <p style={{ margin: '10px 0 0 0', fontSize: 11, color: H.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Scan to verify item
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSingleQrItem(null)} style={{ ...styles.button, ...styles.buttonSecondary, padding: '8px 16px', fontSize: 13 }}>
                Cancel
              </button>
              <button
                onClick={() => printStickersWindow([singleQrItem], `Print QR Sticker - ${singleQrItem.name}`)}
                style={{ ...styles.button, ...styles.buttonPrimary, padding: '8px 16px', fontSize: 13, gap: 6 }}
              >
                <Printer size={14} /> Print Sticker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH QR SHEET MODAL */}
      {showBatchQrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: H.surface, border: `1px solid ${H.border}`, borderRadius: 16, width: '100%', maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: H.surface }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: H.textPrimary }}>Printable Batch QR Sticker Sheet</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: H.textSec }}>
                  {items.length} stickers ready for grid layout printing
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => printStickersWindow(items, 'Inventory Batch QR Sticker Sheet')}
                  style={{ ...styles.button, ...styles.buttonPrimary, padding: '8px 16px', fontSize: 13, gap: 6 }}
                >
                  <Printer size={14} /> Download / Print QR Sheet
                </button>
                <button onClick={() => setShowBatchQrModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: H.textSec, padding: 4 }}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#FAF9F6' }}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {items.map(item => {
                  const code = item.barcode || `INV-2026-${(item.id || '').slice(0, 5)}`
                  const token = item.public_token || item.id
                  const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/item/${token}` : token
                  return (
                    <div key={item.id} style={{ border: '2px dashed #06B6D4', borderRadius: 12, padding: 14, textAlign: 'center', background: '#fff' }}>
                      <h5 style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 800, color: H.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h5>
                      <p style={{ margin: '0 0 8px 0', fontSize: 10, color: H.textSec, fontFamily: 'DM Mono, monospace' }}>
                        {item.category} | {code}
                      </p>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrUrl)}`}
                        alt="QR Code"
                        style={{ width: 100, height: 100, margin: '0 auto', display: 'block', borderRadius: 6, border: `1px solid ${H.border}`, padding: 4 }}
                      />
                      <p style={{ margin: '6px 0 0 0', fontSize: 9, color: H.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Scan to verify
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
