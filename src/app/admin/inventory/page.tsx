'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, Search, AlertTriangle, Plus, Package, SlidersHorizontal, Laptop, FlaskConical, Trophy, BookOpen, Music, TestTube, ShieldAlert } from 'lucide-react'
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

// SUB-COMPONENTS ==============================================================

const InventoryItemCard = ({ item }: { item: any }) => {
  const isLow = item.quantity_available <= item.low_stock_threshold;

  return (
    <Link href={`/admin/inventory/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ ...styles.card, padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: H.mintLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {getCategoryIcon(item.category)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, color: H.textPrimary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
            <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>{item.category}</p>
          </div>
          {isLow && <AlertTriangle size={20} style={{ color: H.accent, flexShrink: 0 }} />}
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
        <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Badge variant="custom" bg={COND_STYLE[item.condition]?.background || COND_STYLE.retired.background} color={COND_STYLE[item.condition]?.color || COND_STYLE.retired.color} style={{ textTransform: 'capitalize' }}>{item.condition || 'Unknown'}</Badge>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0E7490' }}>View Details →</span>
        </div>
      </div>
    </Link>
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
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} style={{ color: '#059669' }} />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
              {items.map(item => (
                <InventoryItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
